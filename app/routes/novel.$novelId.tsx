import { asc, eq } from "drizzle-orm";
import { Link } from "react-router";

import type { Route } from "./+types/novel.$novelId";
import {
  AgeGateNotice,
  ChapterStatusBadge,
  Cover,
  NovelStatusBadge,
  PreviewBanner,
  RatingBadge,
  primaryButton,
} from "~/components/novel-ui";
import { getDb } from "~/db/client";
import { chapters } from "~/db/schema";
import { isChapterLive, isNovelPublic } from "~/lib/moderation";
import { getNovelTags } from "~/lib/novel/access.server";
import { coverUrl } from "~/lib/novel/cover";
import { loadNovelForReader } from "~/lib/novel/reader.server";
import { formatThaiDate } from "~/lib/novel/time";

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  if (!data) return [{ title: "ไม่พบเรื่อง — readable" }];
  const { novel, origin } = data;
  const hideFromSearch = novel.rating === "18+" || !isNovelPublic(novel.status);
  const description = novel.rating === "18+" ? "นิยายสำหรับผู้ที่อายุ 18 ปีขึ้นไป" : novel.synopsis.slice(0, 160);
  const image = coverUrl(novel.coverKey);
  return [
    { title: `${novel.title} — ${novel.author} | readable` },
    { name: "description", content: description },
    { property: "og:type", content: "book" },
    { property: "og:title", content: novel.title },
    { property: "og:description", content: description },
    { property: "og:url", content: origin + location.pathname },
    ...(image && novel.rating !== "18+" ? [{ property: "og:image", content: origin + image }] : []),
    ...(hideFromSearch ? [{ name: "robots", content: "noindex" }] : []),
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { novel, gate, canPreview } = await loadNovelForReader(request, params.novelId);
  const origin = new URL(request.url).origin;
  if (gate !== "ok") {
    // ยังไม่ผ่านการยืนยันอายุ: เห็นแค่ชื่อเรื่องกับป้าย 18+
    return {
      origin,
      gate,
      canPreview,
      novel: { ...novel, synopsis: "", coverKey: null },
      tags: [] as string[],
      chapters: [],
    };
  }
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
  const list = rows
    .map((c) => ({ ...c, live: isChapterLive(c, now) }))
    .filter((c) => c.live || canPreview);
  return { origin, gate, canPreview, novel, tags: await getNovelTags(novel.id), chapters: list };
}

export default function NovelPage({ loaderData }: Route.ComponentProps) {
  const { novel, gate, canPreview, tags, chapters: list } = loaderData;
  const first = list.find((c) => c.live) ?? list[0];
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      {canPreview && !isNovelPublic(novel.status) && (
        <PreviewBanner>
          นักอ่านยังไม่เห็นเรื่องนี้ <NovelStatusBadge status={novel.status} />
        </PreviewBanner>
      )}
      <div className="flex flex-col gap-6 sm:flex-row">
        <Cover coverKey={novel.coverKey} title={novel.title} className="w-40 self-center sm:self-start" />
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold">{novel.title}</h1>
            <RatingBadge rating={novel.rating} />
          </div>
          <p className="text-stone-600 dark:text-stone-400">
            โดย <span className="font-semibold">{novel.author}</span>
            {novel.category && <> · {novel.category}</>}
            {" · "}
            {novel.status === "completed" ? "จบแล้ว" : "ยังไม่จบ"}
          </p>
          {tags.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <li key={t} className="rounded-full bg-stone-100 dark:bg-stone-800 px-3 py-0.5 text-sm">
                  #{t}
                </li>
              ))}
            </ul>
          )}
          {novel.synopsis && <p className="whitespace-pre-line leading-relaxed">{novel.synopsis}</p>}
          {gate === "ok" && first && (
            <Link to={`/novel/${novel.id}/chapter/${first.id}`} className={`inline-block ${primaryButton}`}>
              เริ่มอ่านตอนแรก
            </Link>
          )}
        </div>
      </div>

      {gate !== "ok" ? (
        <AgeGateNotice gate={gate} redirectTo={`/novel/${novel.id}`} />
      ) : (
        <section>
          <h2 className="mb-3 text-lg font-semibold">สารบัญ ({list.filter((c) => c.live).length} ตอน)</h2>
          {list.length === 0 ? (
            <p className="text-stone-500">ยังไม่มีตอนที่เผยแพร่</p>
          ) : (
            <ol className="divide-y divide-stone-200 dark:divide-stone-800 rounded-lg border border-stone-200 dark:border-stone-800">
              {list.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/novel/${novel.id}/chapter/${c.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 dark:hover:bg-stone-900"
                  >
                    <span className="w-10 text-sm text-stone-500">{c.number}</span>
                    <span className="flex-1">{c.title}</span>
                    {!c.live && <ChapterStatusBadge status={c.status} live={false} />}
                    {c.live && c.publishAt && (
                      <span className="text-xs text-stone-500">{formatThaiDate(c.publishAt)}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
