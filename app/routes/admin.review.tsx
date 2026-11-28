import { desc, eq, inArray } from "drizzle-orm";
import { Form, Link, useNavigation } from "react-router";

import type { Route } from "./+types/admin.review";
import { AdminTabs } from "~/components/admin-ui";
import { Cover, NovelStatusBadge, RatingBadge, Notice, dangerButton, inputClass, primaryButton, secondaryButton } from "~/components/novel-ui";
import { getDb } from "~/db/client";
import { novels, users } from "~/db/schema";
import { assertSameOrigin, requireUser } from "~/lib/auth/session.server";
import { requireAdmin } from "~/lib/novel/access.server";
import { formatThaiDateTime } from "~/lib/novel/time";

export function meta({}: Route.MetaArgs) {
  return [{ title: "อนุมัติเรื่อง — readable" }, { name: "robots", content: "noindex" }];
}

const select = {
  id: novels.id,
  title: novels.title,
  synopsis: novels.synopsis,
  coverKey: novels.coverKey,
  rating: novels.rating,
  status: novels.status,
  author: users.displayName,
  updatedAt: novels.updatedAt,
  reviewNote: novels.reviewNote,
};

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  requireAdmin(user);
  const db = getDb();
  const pending = await db
    .select(select)
    .from(novels)
    .innerJoin(users, eq(novels.authorId, users.id))
    .where(eq(novels.status, "pending_review"))
    .orderBy(novels.updatedAt);
  const hidden = await db
    .select(select)
    .from(novels)
    .innerJoin(users, eq(novels.authorId, users.id))
    .where(inArray(novels.status, ["hidden", "rejected"]))
    .orderBy(desc(novels.updatedAt))
    .limit(50);
  return { pending, hidden };
}

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireUser(request);
  requireAdmin(user);
  const form = await request.formData();
  const id = Number(form.get("novelId"));
  const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;
  const intent = String(form.get("intent"));
  const db = getDb();
  const [novel] = await db.select({ status: novels.status }).from(novels).where(eq(novels.id, id));
  if (!novel) return { error: "ไม่พบเรื่อง" };

  const review = { reviewedBy: user.id, reviewedAt: new Date(), reviewNote: note };
  if (intent === "approve" && novel.status === "pending_review") {
    await db.update(novels).set({ ...review, status: "ongoing" }).where(eq(novels.id, id));
    return { ok: "อนุมัติแล้ว เรื่องขึ้นเว็บแล้ว" };
  }
  if (intent === "reject" && novel.status === "pending_review") {
    if (!note) return { error: "กรุณาใส่เหตุผลที่ไม่อนุมัติ นักเขียนจะเห็นข้อความนี้" };
    await db.update(novels).set({ ...review, status: "rejected" }).where(eq(novels.id, id));
    return { ok: "ไม่อนุมัติแล้ว" };
  }
  if (intent === "hide" && novel.status !== "hidden") {
    if (!note) return { error: "กรุณาใส่เหตุผลที่ซ่อน นักเขียนจะเห็นข้อความนี้" };
    await db.update(novels).set({ ...review, status: "hidden" }).where(eq(novels.id, id));
    return { ok: "ซ่อนเรื่องแล้ว" };
  }
  if (intent === "unhide" && novel.status === "hidden") {
    // เรื่อง 18+ ที่ถูกซ่อน เปิดคืนแล้วนับว่า admin อนุมัติแล้ว
    await db.update(novels).set({ ...review, status: "ongoing" }).where(eq(novels.id, id));
    return { ok: "เปิดเรื่องคืนแล้ว" };
  }
  return { error: "ทำรายการนี้ไม่ได้ในสถานะปัจจุบัน" };
}

type Row = Awaited<ReturnType<typeof loader>>["pending"][number];

function NovelRow({ n, children }: { n: Row; children: React.ReactNode }) {
  return (
    <li className="card flex gap-4 p-4">
      <Cover coverKey={n.coverKey} title={n.title} className="w-20" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/novel/${n.id}`} className="font-semibold hover:underline" target="_blank">
            {n.title}
          </Link>
          <RatingBadge rating={n.rating} />
          <NovelStatusBadge status={n.status} />
        </div>
        <p className="text-sm text-muted">
          โดย {n.author} · {formatThaiDateTime(n.updatedAt)}
        </p>
        <p className="text-sm line-clamp-3 whitespace-pre-line">{n.synopsis}</p>
        {n.reviewNote && <p className="text-sm text-muted">หมายเหตุ: {n.reviewNote}</p>}
        {children}
      </div>
    </li>
  );
}

export default function AdminReview({ loaderData, actionData }: Route.ComponentProps) {
  const { pending, hidden } = loaderData;
  const busy = useNavigation().state === "submitting";
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      <AdminTabs />
      <h1 className="text-2xl font-bold">อนุมัติเรื่อง 18+</h1>
      <Notice {...(actionData ?? {})} />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">รออนุมัติ ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-muted">ไม่มีเรื่องรออนุมัติ</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((n) => (
              <NovelRow key={n.id} n={n}>
                <Form method="post" className="space-y-2">
                  <input type="hidden" name="novelId" value={n.id} />
                  <input name="note" placeholder="หมายเหตุ (จำเป็นถ้าไม่อนุมัติ)" className={inputClass} />
                  <div className="flex gap-2">
                    <button name="intent" value="approve" disabled={busy} className={primaryButton}>
                      อนุมัติ
                    </button>
                    <button name="intent" value="reject" disabled={busy} className={dangerButton}>
                      ไม่อนุมัติ
                    </button>
                  </div>
                </Form>
              </NovelRow>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">ถูกซ่อนหรือไม่ผ่าน</h2>
        {hidden.length === 0 ? (
          <p className="text-muted">ไม่มี</p>
        ) : (
          <ul className="space-y-3">
            {hidden.map((n) => (
              <NovelRow key={n.id} n={n}>
                {n.status === "hidden" && (
                  <Form method="post">
                    <input type="hidden" name="novelId" value={n.id} />
                    <button name="intent" value="unhide" disabled={busy} className={secondaryButton}>
                      เปิดเรื่องคืน
                    </button>
                  </Form>
                )}
              </NovelRow>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
