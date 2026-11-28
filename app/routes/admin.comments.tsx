import { desc, eq } from "drizzle-orm";
import { Form, Link, useNavigation } from "react-router";

import type { Route } from "./+types/admin.comments";
import { AdminTabs } from "~/components/admin-ui";
import { Notice, inputClass } from "~/components/novel-ui";
import { getDb } from "~/db/client";
import { chapters, comments, novels, users } from "~/db/schema";
import { assertSameOrigin, requireUser } from "~/lib/auth/session.server";
import { setCommentHidden } from "~/lib/community.server";
import { requireAdmin } from "~/lib/novel/access.server";
import { formatThaiDateTime } from "~/lib/novel/time";

export function meta({}: Route.MetaArgs) {
  return [{ title: "จัดการคอมเมนต์ — readable" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  requireAdmin(await requireUser(request));
  const onlyHidden = new URL(request.url).searchParams.get("show") === "hidden";
  const rows = await getDb()
    .select({
      id: comments.id,
      body: comments.body,
      status: comments.status,
      hiddenReason: comments.hiddenReason,
      createdAt: comments.createdAt,
      author: users.displayName,
      authorEmail: users.email,
      chapterId: chapters.id,
      chapterTitle: chapters.title,
      novelId: novels.id,
      novelTitle: novels.title,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .innerJoin(chapters, eq(comments.chapterId, chapters.id))
    .innerJoin(novels, eq(chapters.novelId, novels.id))
    .where(onlyHidden ? eq(comments.status, "hidden") : undefined)
    .orderBy(desc(comments.createdAt))
    .limit(100);
  return { onlyHidden, comments: rows };
}

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireUser(request);
  requireAdmin(user);
  const form = await request.formData();
  const id = Number(form.get("commentId"));
  const intent = String(form.get("intent"));
  if (!Number.isInteger(id)) return { error: "ไม่พบคอมเมนต์" };
  if (intent === "hide") {
    await setCommentHidden(id, user.id, true, String(form.get("reason") ?? ""));
    return { ok: "ซ่อนคอมเมนต์แล้ว" };
  }
  if (intent === "unhide") {
    await setCommentHidden(id, user.id, false);
    return { ok: "เลิกซ่อนคอมเมนต์แล้ว" };
  }
  return { error: "ทำรายการนี้ไม่ได้" };
}

export default function AdminComments({ loaderData, actionData }: Route.ComponentProps) {
  const { onlyHidden, comments: list } = loaderData;
  const busy = useNavigation().state === "submitting";
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <AdminTabs />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">คอมเมนต์ล่าสุด</h1>
        <Link to={onlyHidden ? "/admin/comments" : "/admin/comments?show=hidden"} className="text-sm text-accent hover:underline">
          {onlyHidden ? "ดูทั้งหมด" : "ดูเฉพาะที่ถูกซ่อน"}
        </Link>
      </div>
      <Notice {...(actionData ?? {})} />
      {list.length === 0 ? (
        <p className="text-muted">ยังไม่มีคอมเมนต์</p>
      ) : (
        <ul className="space-y-3">
          {list.map((c) => (
            <li key={c.id} className={`card space-y-2 p-3 ${c.status === "hidden" ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-semibold">{c.author}</span>
                <span className="text-muted">{c.authorEmail}</span>
                <span className="text-xs text-muted">{formatThaiDateTime(c.createdAt)}</span>
                {c.status === "hidden" && (
                  <span className="badge badge-danger">ถูกซ่อน{c.hiddenReason ? `: ${c.hiddenReason}` : ""}</span>
                )}
              </div>
              <p className="whitespace-pre-line [overflow-wrap:anywhere]">{c.body}</p>
              <p className="text-xs text-muted">
                ใน{" "}
                <Link to={`/novel/${c.novelId}/chapter/${c.chapterId}#comments-title`} target="_blank" className="hover:underline">
                  {c.novelTitle} · {c.chapterTitle}
                </Link>
              </p>
              <Form method="post" className="flex flex-wrap gap-2">
                <input type="hidden" name="commentId" value={c.id} />
                {c.status === "hidden" ? (
                  <button name="intent" value="unhide" disabled={busy} className="text-sm text-accent hover:underline">
                    เลิกซ่อน
                  </button>
                ) : (
                  <>
                    <input name="reason" placeholder="เหตุผล (ไม่บังคับ)" className={`${inputClass} mt-0! min-h-9! flex-1 py-1! text-sm`} />
                    <button name="intent" value="hide" disabled={busy} className="text-sm text-danger hover:underline">
                      ซ่อน
                    </button>
                  </>
                )}
              </Form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
