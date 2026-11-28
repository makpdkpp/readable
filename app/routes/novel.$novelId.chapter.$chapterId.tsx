import { and, asc, eq } from "drizzle-orm";
import { Link } from "react-router";

import type { Route } from "./+types/novel.$novelId.chapter.$chapterId";
import { AgeGateNotice, PreviewBanner, RatingBadge } from "~/components/novel-ui";
import { ReaderSettings, THEME_STYLE, useReaderPrefs } from "~/components/reader-settings";
import { getDb } from "~/db/client";
import { chapters } from "~/db/schema";
import { isChapterLive, isNovelPublic } from "~/lib/moderation";
import { CommentSection, LikeButton } from "~/components/chapter-community";
import { assertSameOrigin, requireUser } from "~/lib/auth/session.server";
import { RATE_LIMIT_MESSAGE, isRateLimited } from "~/lib/rate-limit.server";
import { parseCommentBody } from "~/lib/community";
import { addComment, deleteOwnComment, setCommentHidden, getChapterLikes, listChapterComments, setChapterLike } from "~/lib/community.server";
import { coverUrl } from "~/lib/novel/cover";
import { htmlToText, pageMeta, truncate } from "~/lib/seo";
import { recordRead } from "~/lib/novel/library.server";
import { loadNovelForReader } from "~/lib/novel/reader.server";
import { formatThaiDateTime } from "~/lib/novel/time";

export function meta({ loaderData: data }: Route.MetaArgs) {
  if (!data) return [{ title: "ไม่พบตอน — readable" }];
  const { novel, chapter, origin } = data;
  const adult = novel.rating === "18+";
  const image = coverUrl(novel.coverKey);
  return pageMeta({
    title: `${chapter ? `${chapter.title} — ` : ""}${novel.title} | readable`,
    description: adult ? "นิยายสำหรับผู้ที่อายุ 18 ปีขึ้นไป" : chapter?.excerpt || `${novel.title} โดย ${novel.author}`,
    url: chapter ? `${origin}/novel/${novel.id}/chapter/${chapter.id}` : `${origin}/novel/${novel.id}`,
    image: image && !adult ? origin + image : null,
    type: "article",
    noindex: adult || !isNovelPublic(novel.status) || !chapter?.live,
  });
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { novel, gate, canPreview, viewer } = await loadNovelForReader(request, params.novelId);
  const origin = new URL(request.url).origin;
  const novelInfo = {
    id: novel.id,
    title: novel.title,
    author: novel.author,
    rating: novel.rating,
    status: novel.status,
    // ปกของเรื่อง 18+ ใช้เฉพาะคนที่ผ่านการยืนยันอายุ
    coverKey: gate === "ok" ? novel.coverKey : null,
  };
  const viewerInfo = viewer && { id: viewer.id, isAdmin: viewer.role === "admin" };
  if (gate !== "ok")
    return { origin, gate, novel: novelInfo, chapter: null, prev: null, next: null, viewer: viewerInfo, likes: null, comments: [] };

  const chapterId = Number(params.chapterId);
  const now = new Date();
  const rows = await getDb()
    .select({
      id: chapters.id,
      number: chapters.number,
      title: chapters.title,
      status: chapters.status,
      publishAt: chapters.publishAt,
    })
    .from(chapters)
    .where(eq(chapters.novelId, novel.id))
    .orderBy(asc(chapters.number));
  const visible = rows.filter((c) => canPreview || isChapterLive(c, now));
  const idx = visible.findIndex((c) => c.id === chapterId);
  if (idx < 0) throw new Response("Not Found", { status: 404 });

  const [body] = await getDb()
    .select({ contentHtml: chapters.contentHtml })
    .from(chapters)
    .where(and(eq(chapters.id, chapterId), eq(chapters.novelId, novel.id)));
  const c = visible[idx];
  const live = isChapterLive(c, now);
  if (viewer && live) await recordRead(viewer.id, novel.id, c.id);
  const [likes, commentRows] = live
    ? await Promise.all([getChapterLikes(c.id, viewer?.id ?? null), listChapterComments(c.id, viewer)])
    : [null, []];
  const pick = (x: (typeof visible)[number] | undefined) => (x ? { id: x.id, title: x.title } : null);
  const contentHtml = body?.contentHtml ?? "";
  return {
    origin,
    gate,
    novel: novelInfo,
    chapter: {
      id: c.id,
      number: c.number,
      title: c.title,
      publishAt: c.publishAt,
      live,
      contentHtml,
      excerpt: truncate(htmlToText(contentHtml), 160),
    },
    prev: pick(visible[idx - 1]),
    next: pick(visible[idx + 1]),
    viewer: viewerInfo,
    likes,
    comments: commentRows,
  };
}

/** ถูกใจและคอมเมนต์ได้เฉพาะตอนที่ขึ้นเว็บแล้ว และผู้ใช้ต้องเปิดอ่านเรื่องนี้ได้ */
async function requireLiveChapter(request: Request, params: Route.ActionArgs["params"]) {
  const { novel, gate, viewer } = await loadNovelForReader(request, params.novelId);
  if (!viewer || gate !== "ok" || !isNovelPublic(novel.status)) throw new Response("Forbidden", { status: 403 });
  const chapterId = Number(params.chapterId);
  const [c] = await getDb()
    .select({ id: chapters.id, status: chapters.status, publishAt: chapters.publishAt })
    .from(chapters)
    .where(and(eq(chapters.id, chapterId), eq(chapters.novelId, novel.id)));
  if (!c || !isChapterLive(c)) throw new Response("Not Found", { status: 404 });
  return { viewer, chapterId: c.id };
}

export async function action({ request, params }: Route.ActionArgs) {
  assertSameOrigin(request);
  await requireUser(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const { viewer, chapterId } = await requireLiveChapter(request, params);
  if (await isRateLimited("write", viewer.id)) return { error: RATE_LIMIT_MESSAGE };

  if (intent === "like" || intent === "unlike") {
    await setChapterLike(viewer.id, chapterId, intent === "like");
    return { ok: true };
  }
  if (intent === "comment") {
    const parsed = parseCommentBody(form.get("body"));
    if ("error" in parsed) return { error: parsed.error };
    return addComment(viewer.id, chapterId, parsed.body);
  }
  const commentId = Number(form.get("commentId"));
  if (intent === "delete-comment" && Number.isInteger(commentId)) {
    await deleteOwnComment(viewer.id, commentId);
    return { ok: true };
  }
  if ((intent === "hide-comment" || intent === "unhide-comment") && Number.isInteger(commentId)) {
    if (viewer.role !== "admin") throw new Response("Forbidden", { status: 403 });
    await setCommentHidden(commentId, viewer.id, intent === "hide-comment");
    return { ok: true };
  }
  return { error: "ทำรายการนี้ไม่ได้" };
}

export default function ReadChapter({ loaderData }: Route.ComponentProps) {
  const { gate, novel, chapter, prev, next, viewer, likes, comments } = loaderData;
  const [prefs, update] = useReaderPrefs();

  if (gate !== "ok") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          {novel.title} <RatingBadge rating={novel.rating} />
        </h1>
        <AgeGateNotice gate={gate} redirectTo={`/novel/${novel.id}`} />
      </div>
    );
  }

  if (!chapter) return null;
  const loginHref = `/login?redirectTo=${encodeURIComponent(`/novel/${novel.id}/chapter/${chapter.id}`)}`;

  const nav = (
    <nav className="flex items-center justify-between gap-2 text-sm">
      {prev ? (
        <Link to={`/novel/${novel.id}/chapter/${prev.id}`} className="rounded-md border border-current/20 px-3 py-2 hover:bg-subtle">
          ← ตอนก่อนหน้า
        </Link>
      ) : (
        <span />
      )}
      <Link to={`/novel/${novel.id}`} className="hover:underline">
        สารบัญ
      </Link>
      {next ? (
        <Link to={`/novel/${novel.id}/chapter/${next.id}`} className="rounded-md border border-current/20 px-3 py-2 hover:bg-subtle">
          ตอนถัดไป →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );

  return (
    <div style={THEME_STYLE[prefs.theme]} className="min-h-[calc(100vh-3.5rem)]">
      <article className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {!chapter.live && <PreviewBanner>ตัวอย่าง นักอ่านยังไม่เห็นตอนนี้</PreviewBanner>}
        <header className="flex items-start justify-between gap-4">
          <div>
            <Link to={`/novel/${novel.id}`} className="text-sm opacity-70 hover:underline">
              {novel.title} · {novel.author}
            </Link>
            <h1 className="mt-1 text-2xl font-bold">{chapter.title}</h1>
            {chapter.live && chapter.publishAt && (
              <p className="mt-1 text-xs opacity-60">{formatThaiDateTime(chapter.publishAt)}</p>
            )}
          </div>
          <ReaderSettings prefs={prefs} update={update} />
        </header>
        <div
          className="chapter-content"
          style={{ fontSize: `${prefs.fontSize}px`, lineHeight: prefs.lineHeight }}
          // HTML นี้สร้างฝั่ง server จาก JSON ด้วย renderContentHtml ซึ่ง escape ข้อความทั้งหมดแล้ว
          dangerouslySetInnerHTML={{ __html: chapter.contentHtml }}
        />
        {likes && (
          <div className="flex justify-center">
            <LikeButton count={likes.count} liked={likes.liked} loginHref={viewer ? null : loginHref} />
          </div>
        )}
        {nav}
        {chapter.live && (
          <div className="border-t border-current/15 pt-6">
            <CommentSection comments={comments} viewer={viewer} loginHref={loginHref} />
          </div>
        )}
      </article>
    </div>
  );
}
