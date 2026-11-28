import { env } from "cloudflare:workers";
import { desc, eq, or, sql } from "drizzle-orm";
import { Form, useNavigation } from "react-router";

import type { Route } from "./+types/admin.users";
import { AdminTabs } from "~/components/admin-ui";
import { Notice, inputClass, secondaryButton } from "~/components/novel-ui";
import { getDb } from "~/db/client";
import { users } from "~/db/schema";
import { ROLES, ROLE_LABEL, isRole, parseAdminEmails, roleChangeError } from "~/lib/admin";
import { assertSameOrigin, requireUser } from "~/lib/auth/session.server";
import { requireAdmin } from "~/lib/novel/access.server";
import { formatThaiDate } from "~/lib/novel/time";
import { likePattern, normalizeQuery } from "~/lib/search";

export function meta({}: Route.MetaArgs) {
  return [{ title: "จัดการผู้ใช้ — readable" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const me = await requireUser(request);
  requireAdmin(me);
  const q = normalizeQuery(new URL(request.url).searchParams.get("q"));
  const pattern = likePattern(q);
  const rows = await getDb()
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      q
        ? or(sql`${users.email} like ${pattern} escape '\\'`, sql`${users.displayName} like ${pattern} escape '\\'`)
        : undefined,
    )
    // admin ขึ้นก่อน แล้วเรียงตามวันที่สมัครล่าสุด
    .orderBy(sql`${users.role} = 'admin' desc`, desc(users.createdAt))
    .limit(100);
  const pinned = parseAdminEmails(env.ADMIN_EMAILS);
  return {
    q,
    meId: me.id,
    users: rows.map((u) => ({ ...u, pinned: pinned.has(u.email.toLowerCase()) })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const me = await requireUser(request);
  requireAdmin(me);
  const form = await request.formData();
  const role = form.get("role");
  if (!isRole(role)) return { error: "ไม่มีสิทธิ์แบบนี้" };
  const db = getDb();
  const [target] = await db
    .select({ id: users.id, email: users.email, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, String(form.get("userId"))));
  if (!target) return { error: "ไม่พบผู้ใช้" };
  const err = roleChangeError(me, target, role, parseAdminEmails(env.ADMIN_EMAILS));
  if (err) return { error: err };
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, target.id));
  return { ok: `ตั้ง ${target.displayName} เป็น${ROLE_LABEL[role]}แล้ว` };
}

export default function AdminUsers({ loaderData, actionData }: Route.ComponentProps) {
  const { q, meId, users: list } = loaderData;
  const busy = useNavigation().state === "submitting";
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <AdminTabs />
      <h1 className="text-2xl font-bold">ผู้ใช้</h1>
      <p className="text-sm text-muted">
        แอดมินอนุมัติเรื่อง 18+ ซ่อนเรื่องและคอมเมนต์ และตั้งสิทธิ์คนอื่นได้ ส่วนนักอ่านกับนักเขียนใช้งานได้เหมือนกัน
      </p>
      <Notice {...(actionData ?? {})} />
      <Form method="get" className="flex gap-2">
        <input name="q" type="search" defaultValue={q} placeholder="อีเมลหรือชื่อ" className={`${inputClass} mt-0!`} />
        <button className={secondaryButton}>ค้นหา</button>
      </Form>
      <ul className="card divide-y divide-line overflow-hidden">
        {list.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {u.displayName}
                {u.id === meId && <span className="text-sm font-normal text-muted"> (คุณ)</span>}
              </p>
              <p className="truncate text-sm text-muted">
                {u.email} · สมัคร {formatThaiDate(u.createdAt)}
              </p>
            </div>
            {u.pinned ? (
              <span className="badge badge-info" title="ตั้งไว้ในตัวแปร ADMIN_EMAILS">
                แอดมิน (ADMIN_EMAILS)
              </span>
            ) : (
              <Form method="post" className="flex items-center gap-2">
                <input type="hidden" name="userId" value={u.id} />
                <label htmlFor={`role-${u.id}`} className="sr-only">
                  สิทธิ์ของ {u.displayName}
                </label>
                <select
                  id={`role-${u.id}`}
                  name="role"
                  defaultValue={u.role}
                  disabled={u.id === meId}
                  className={`${inputClass} mt-0! w-auto!`}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                {u.id !== meId && (
                  <button disabled={busy} className={secondaryButton}>
                    บันทึก
                  </button>
                )}
              </Form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
