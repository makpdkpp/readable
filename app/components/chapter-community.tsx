import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";

import { primaryButton } from "~/components/novel-ui";
import { COMMENT_MAX } from "~/lib/community";
import { formatThaiDateTime } from "~/lib/novel/time";

type Viewer = { id: string; isAdmin: boolean } | null;

export type CommentItem = {
  id: number;
  body: string;
  status: "visible" | "hidden";
  hiddenReason: string | null;
  createdAt: Date | string;
  userId: string;
  author: string;
};

// หน้าอ่านมีสีพื้นของตัวเอง (สว่าง ซีเปีย มืด) ส่วนนี้จึงใช้ currentColor แทนสีของธีมเว็บ
const outline = "rounded-md border border-current/20";

export function LikeButton({
  count,
  liked,
  loginHref,
}: {
  count: number;
  liked: boolean;
  loginHref: string | null;
}) {
  const fetcher = useFetcher();
  const pending = fetcher.formData?.get("intent");
  const showLiked = pending ? pending === "like" : liked;
  const shown = count + (pending ? (showLiked ? 1 : 0) - (liked ? 1 : 0) : 0);
  const inner = (
    <>
      <span aria-hidden="true" className={showLiked ? "text-accent" : ""}>
        {showLiked ? "♥" : "♡"}
      </span>
      ถูกใจ {shown > 0 && <span className="tabular-nums">{shown}</span>}
    </>
  );
  const cls = `${outline} inline-flex items-center gap-2 px-4 py-2 text-sm hover:bg-current/5`;
  if (loginHref) {
    return (
      <a href={loginHref} className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <fetcher.Form method="post" preventScrollReset>
      <button name="intent" value={showLiked ? "unlike" : "like"} aria-pressed={showLiked} className={cls}>
        {inner}
      </button>
    </fetcher.Form>
  );
}

export function CommentSection({
  comments,
  viewer,
  loginHref,
}: {
  comments: CommentItem[];
  viewer: Viewer;
  loginHref: string;
}) {
  const fetcher = useFetcher<{ error?: string; ok?: boolean }>();
  const formRef = useRef<HTMLFormElement>(null);
  const posting = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "comment";
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) formRef.current?.reset();
  }, [fetcher.state, fetcher.data]);

  const visibleCount = comments.filter((c) => c.status === "visible").length;
  return (
    <section className="space-y-4" aria-labelledby="comments-title">
      <h2 id="comments-title" className="text-lg font-semibold">
        คอมเมนต์ ({visibleCount})
      </h2>
      {viewer ? (
        <fetcher.Form method="post" ref={formRef} className="space-y-2" preventScrollReset>
          <input type="hidden" name="intent" value="comment" />
          <label htmlFor="comment-body" className="sr-only">
            เขียนคอมเมนต์
          </label>
          <textarea
            id="comment-body"
            name="body"
            required
            rows={3}
            maxLength={COMMENT_MAX}
            placeholder="เขียนคอมเมนต์ถึงตอนนี้"
            className={`${outline} block w-full bg-transparent px-3 py-2`}
          />
          {fetcher.data?.error && (
            <p role="alert" className="text-sm text-danger">
              {fetcher.data.error}
            </p>
          )}
          <button type="submit" disabled={posting} className={primaryButton}>
            {posting ? "กำลังส่ง…" : "ส่งคอมเมนต์"}
          </button>
        </fetcher.Form>
      ) : (
        <p className="text-sm opacity-80">
          <a href={loginHref} className="underline">
            เข้าสู่ระบบ
          </a>{" "}
          เพื่อคอมเมนต์
        </p>
      )}
      {comments.length === 0 ? (
        <p className="text-sm opacity-70">ยังไม่มีคอมเมนต์ เป็นคนแรกเลย</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <CommentRow key={c.id} c={c} viewer={viewer} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CommentRow({ c, viewer }: { c: CommentItem; viewer: Viewer }) {
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";
  const mine = viewer?.id === c.userId;
  // ลบแล้วซ่อนทันทีไม่ต้องรอโหลดใหม่
  if (busy && fetcher.formData?.get("intent") === "delete-comment") return null;
  return (
    <li className={`${outline} space-y-1 px-3 py-2 ${c.status === "hidden" ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-semibold">{c.author}</span>
        <span className="text-xs opacity-60">{formatThaiDateTime(new Date(c.createdAt))}</span>
        {c.status === "hidden" && (
          <span className="badge badge-danger">ถูกซ่อน{c.hiddenReason ? `: ${c.hiddenReason}` : ""}</span>
        )}
      </div>
      <p className="whitespace-pre-line [overflow-wrap:anywhere]">{c.body}</p>
      {mine && (
        <fetcher.Form method="post" className="flex flex-wrap gap-3 text-xs opacity-70" preventScrollReset>
          <input type="hidden" name="commentId" value={c.id} />
          <button name="intent" value="delete-comment" disabled={busy} className="hover:underline">
            ลบ
          </button>
        </fetcher.Form>
      )}
    </li>
  );
}
