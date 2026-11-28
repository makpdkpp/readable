import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { Form, Link, useNavigation } from "react-router";

import type { Route } from "./+types/admin.novels";
import { AdminTabs } from "~/components/admin-ui";
import { Cover, NovelStatusBadge, Notice, RatingBadge, dangerButton, inputClass, secondaryButton } from "~/components/novel-ui";
import { getDb } from "~/db/client";
import { novels, users } from "~/db/schema";
import { assertSameOrigin, requireUser } from "~/lib/auth/session.server";
import { PUBLIC_STATUSES } from "~/lib/moderation";
import { requireAdmin } from "~/lib/novel/access.server";
import { formatThaiDateTime } from "~/lib/novel/time";
import { likePattern, normalizeQuery } from "~/lib/search";

export function meta({}: Route.MetaArgs) {
  return [{ title: "จัดการเรื่อง — readable" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  requireAdmin(await requireUser(request));
  const q = normalizeQuery(new URL(request.url).searchParams.get("q"));
  const id = Number(q);
  const pattern = likePattern(q);
  const match = q
    ? or(
        Number.isInteger(id) && id > 0 ? eq(novels.id, id) : undefined,
        sql`${novels.title} like ${pattern} escape '\\'`,
        sql`${users.displayName} like ${pattern} escape '\\'`,
      )
    : undefined;
  const rows = await getDb()
    .select({
      id: novels.id,
      title: novels.title,
      coverKey: novels.coverKey,
      rating: novels.rating,
      status: novels.status,
      author: users.displayName,
      updatedAt: novels.updatedAt,
    })
    .from(novels)
    .innerJoin(users, eq(novels.authorId, users.id))
    .where(and(inArray(novels.status, [...PUBLIC_STATUSES]), match))
    .orderBy(desc(novels.updatedAt))
    .limit(100);
  return { q, novels: rows };
}

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireUser(request);
  requireAdmin(user);
  const form = await request.formData();
  const id = Number(form.get("novelId"));
  const note = String(form.get("note") ?? "").trim().slice(0, 500);
  if (!note) return { error: "กรุณาใส่เหตุผลที่ซ่อน นักเขียนจะเห็นข้อความนี้" };
  const db = getDb();
  const [novel] = await db.select({ status: novels.status }).from(novels).where(eq(novels.id, id));
  if (!novel || novel.status === "hidden") return { error: "ไม่พบเรื่อง หรือเรื่องถูกซ่อนอยู่แล้ว" };
  await db
    .update(novels)
    .set({ status: "hidden", reviewedBy: user.id, reviewedAt: new Date(), reviewNote: note })
    .where(eq(novels.id, id));
  return { ok: "ซ่อนเรื่องแล้ว เปิดคืนได้ที่แท็บ “อนุมัติ 18+” หัวข้อ “ถูกซ่อนหรือไม่ผ่าน”" };
}

export default function AdminNovels({ loaderData, actionData }: Route.ComponentProps) {
  const { q, novels: list } = loaderData;
  const busy = useNavigation().state === "submitting";
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <AdminTabs />
      <h1 className="text-2xl font-bold">เรื่องที่เผยแพร่อยู่</h1>
      <Notice {...(actionData ?? {})} />
      <Form method="get" className="flex gap-2">
        <input name="q" type="search" defaultValue={q} placeholder="ชื่อเรื่อง ชื่อนักเขียน หรือเลขเรื่อง" className={`${inputClass} mt-0!`} />
        <button className={secondaryButton}>ค้นหา</button>
      </Form>
      {list.length === 0 ? (
        <p className="text-muted">ไม่พบเรื่อง</p>
      ) : (
        <ul className="space-y-3">
          {list.map((n) => (
            <li key={n.id} className="card flex gap-4 p-3">
              <Cover coverKey={n.coverKey} title={n.title} className="w-14" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/novel/${n.id}`} target="_blank" className="font-semibold hover:underline">
                    {n.title}
                  </Link>
                  <RatingBadge rating={n.rating} />
                  <NovelStatusBadge status={n.status} />
                </div>
                <p className="text-sm text-muted">
                  #{n.id} · โดย {n.author} · {formatThaiDateTime(n.updatedAt)}
                </p>
                <details>
                  <summary className="cursor-pointer text-sm text-danger">ซ่อนเรื่องนี้</summary>
                  <Form method="post" className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="novelId" value={n.id} />
                    <input name="note" required placeholder="เหตุผล (นักเขียนจะเห็น)" className={`${inputClass} mt-0! flex-1`} />
                    <button disabled={busy} className={dangerButton}>
                      ยืนยันซ่อน
                    </button>
                  </Form>
                </details>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
