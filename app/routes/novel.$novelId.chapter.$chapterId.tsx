import { and, asc, eq } from "drizzle-orm";
import { Link } from "react-router";

import type { Route } from "./+types/novel.$novelId.chapter.$chapterId";
import { AgeGateNotice, PreviewBanner, RatingBadge } from "~/components/novel-ui";
import { ReaderSettings, THEME_STYLE, useReaderPrefs } from "~/components/reader-settings";
import { getDb } from "~/db/client";
import { chapters } from "~/db/schema";
import { isChapterLive, isNovelPublic } from "~/lib/moderation";
import { loadNovelForReader } from "~/lib/novel/reader.server";
import { formatThaiDateTime } from "~/lib/novel/time";

export function meta({ loaderData: data }: Route.MetaArgs) {
  if (!data) return [{ title: "ไม่พบตอน — readable" }];
  const { novel, chapter } = data;
  const hide = novel.rating === "18+" || !isNovelPublic(novel.status) || !chapter?.live;
  return [
    { title: `${chapter ? `${chapter.title} — ` : ""}${novel.title} | readable` },
    ...(hide ? [{ name: "robots", content: "noindex" }] : []),
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { novel, gate, canPreview } = await loadNovelForReader(request, params.novelId);
  const novelInfo = { id: novel.id, title: novel.title, author: novel.author, rating: novel.rating, status: novel.status };
  if (gate !== "ok") return { gate, novel: novelInfo, chapter: null, prev: null, next: null };

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
  const pick = (x: (typeof visible)[number] | undefined) => (x ? { id: x.id, title: x.title } : null);
  return {
    gate,
    novel: novelInfo,
    chapter: {
      id: c.id,
      number: c.number,
      title: c.title,
      publishAt: c.publishAt,
      live: isChapterLive(c, now),
      contentHtml: body?.contentHtml ?? "",
    },
    prev: pick(visible[idx - 1]),
    next: pick(visible[idx + 1]),
  };
}

export default function ReadChapter({ loaderData }: Route.ComponentProps) {
  const { gate, novel, chapter, prev, next } = loaderData;
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
        {nav}
      </article>
    </div>
  );
}
