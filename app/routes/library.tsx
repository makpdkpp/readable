import { Form, Link } from "react-router";

import type { Route } from "./+types/library";
import { Cover, RatingBadge, secondaryButton } from "~/components/novel-ui";
import { assertSameOrigin, requireUser } from "~/lib/auth/session.server";
import { clearHistory, listLibrary, removeFromHistory, setSaved } from "~/lib/novel/library.server";
import { formatThaiDateTime } from "~/lib/novel/time";

export function meta({}: Route.MetaArgs) {
  return [{ title: "ชั้นหนังสือ — readable" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const view = new URL(request.url).searchParams.get("view") === "history" ? "history" : "shelf";
  return { view, items: await listLibrary(user.id, view) } as const;
}

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const novelId = Number(form.get("novelId"));
  if (intent === "clear-history") await clearHistory(user.id);
  else if (Number.isInteger(novelId) && novelId > 0) {
    if (intent === "unsave") await setSaved(user.id, novelId, false);
    if (intent === "forget") await removeFromHistory(user.id, novelId);
  }
  return null;
}

export default function Library({ loaderData }: Route.ComponentProps) {
  const { view, items } = loaderData;
  const tab = (v: "shelf" | "history", label: string) => (
    <Link
      to={v === "shelf" ? "/library" : "/library?view=history"}
      className={`tab ${view === v ? "tab-active" : ""}`}
      aria-current={view === v ? "page" : undefined}
    >
      {label}
    </Link>
  );
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="tabs" aria-label="ชั้นหนังสือ">
          {tab("shelf", "ชั้นหนังสือ")}
          {tab("history", "ประวัติการอ่าน")}
        </nav>
        {view === "history" && items.length > 0 && (
          <Form method="post">
            <button name="intent" value="clear-history" className="text-sm text-muted hover:underline">
              ล้างประวัติทั้งหมด
            </button>
          </Form>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card p-10 text-center text-muted">
          {view === "shelf" ? (
            <>
              ชั้นหนังสือยังว่าง กด “+ เก็บเข้าชั้น” ในหน้าเรื่องที่ชอบ{" "}
              <Link to="/" className="text-accent hover:underline">
                ไปหาเรื่องอ่าน
              </Link>
            </>
          ) : (
            "ยังไม่มีประวัติการอ่าน"
          )}
        </div>
      ) : (
        <ul className="card-list space-y-3">
          {items.map((n) => {
            const unread = n.lastChapterId ? n.newChapters : 0;
            return (
              <li key={n.novelId}>
                <div className="card flex gap-4 p-3">
                  <Link to={`/novel/${n.novelId}`} className="shrink-0">
                    <Cover coverKey={n.coverKey} title={n.title} className="w-16" />
                  </Link>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Link to={`/novel/${n.novelId}`} className="truncate font-semibold hover:underline">
                        {n.title}
                      </Link>
                      <RatingBadge rating={n.rating} />
                    </div>
                    <p className="text-sm text-muted">
                      โดย {n.author} · {n.liveChapters} ตอน{n.status === "completed" ? " · จบแล้ว" : ""}
                    </p>
                    {n.lastChapterId ? (
                      <p className="text-sm">
                        อ่านถึงตอนที่ {n.lastChapterNumber} {n.lastChapterTitle}
                        {n.lastReadAt && <span className="text-muted"> · {formatThaiDateTime(n.lastReadAt)}</span>}
                        {unread > 0 && <span className="badge badge-info ml-2">ตอนใหม่ {unread}</span>}
                      </p>
                    ) : (
                      <p className="text-sm text-muted">ยังไม่ได้เริ่มอ่าน</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {n.lastChapterId && (
                        <Link
                          to={`/novel/${n.novelId}/chapter/${n.lastChapterId}`}
                          className={`${secondaryButton} min-h-9! px-3! py-1! text-sm`}
                        >
                          อ่านต่อ
                        </Link>
                      )}
                      <Form method="post">
                        <input type="hidden" name="novelId" value={n.novelId} />
                        <button
                          name="intent"
                          value={view === "shelf" ? "unsave" : "forget"}
                          className="text-sm text-muted hover:underline"
                        >
                          {view === "shelf" ? "เอาออกจากชั้น" : "ลบจากประวัติ"}
                        </button>
                      </Form>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
