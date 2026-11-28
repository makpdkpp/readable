import { asc, eq } from "drizzle-orm";
import { Form, Link, useNavigation } from "react-router";

import type { Route } from "./+types/novel.$novelId";
import {
  AgeGateNotice,
  ChapterStatusBadge,
  Cover,
  NovelStatusBadge,
  PreviewBanner,
  RatingBadge,
  primaryButton,
  secondaryButton,
} from "~/components/novel-ui";
import { getDb } from "~/db/client";
import { chapters } from "~/db/schema";
import { isChapterLive, isNovelPublic } from "~/lib/moderation";
import { getNovelTags } from "~/lib/novel/access.server";
import { coverUrl } from "~/lib/novel/cover";
import { assertSameOrigin, requireUser } from "~/lib/auth/session.server";
import { getLibraryEntry, setSaved } from "~/lib/novel/library.server";
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
  const { novel, gate, canPreview, viewer } = await loadNovelForReader(request, params.novelId);
  const origin = new URL(request.url).origin;
  const entry = viewer && gate === "ok" ? await getLibraryEntry(viewer.id, novel.id) : null;
  const loggedIn = !!viewer;
  if (gate !== "ok") {
    // ยังไม่ผ่านการยืนยันอายุ: เห็นแค่ชื่อเรื่องกับป้าย 18+
    return {
      origin,
      gate,
      canPreview,
      novel: { ...novel, synopsis: "", coverKey: null },
      tags: [] as string[],
      chapters: [],
      entry,
      loggedIn,
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
  return { origin, gate, canPreview, novel, tags: await getNovelTags(novel.id), chapters: list, entry, loggedIn };
}

export async function action({ request, params }: Route.ActionArgs) {
  assertSameOrigin(request);
  await requireUser(request);
  const { novel, viewer, gate } = await loadNovelForReader(request, params.novelId);
  if (!viewer || gate !== "ok") throw new Response("Forbidden", { status: 403 });
  const intent = String((await request.formData()).get("intent"));
  if (intent === "save" || intent === "unsave") await setSaved(viewer.id, novel.id, intent === "save");
  return null;
}

function ShelfButton({ saved, loggedIn, novelId }: { saved: boolean; loggedIn: boolean; novelId: number }) {
  const nav = useNavigation();
  const pending = nav.formData?.get("intent");
  const showSaved = pending ? pending === "save" : saved;
  if (!loggedIn) {
    return (
      <a href={`/login?redirectTo=${encodeURIComponent(`/novel/${novelId}`)}`} className={secondaryButton}>
        + เก็บเข้าชั้น
      </a>
    );
  }
  return (
    <Form method="post" preventScrollReset>
      <button
        name="intent"
        value={showSaved ? "unsave" : "save"}
        className={secondaryButton}
        aria-pressed={showSaved}
      >
        {showSaved ? "✓ อยู่ในชั้นหนังสือ" : "+ เก็บเข้าชั้น"}
      </button>
    </Form>
  );
}

export default function NovelPage({ loaderData }: Route.ComponentProps) {
  const { novel, gate, canPreview, tags, chapters: list, entry, loggedIn } = loaderData;
  const first = list.find((c) => c.live) ?? list[0];
  const resume = entry?.lastChapterId ? list.find((c) => c.id === entry.lastChapterId) : undefined;
  const cover = coverUrl(novel.coverKey);
  return (
    <div className="relative">
      {cover && (
        <div className="novel-backdrop" aria-hidden="true">
          <div style={{ backgroundImage: `url(${cover})` }} />
        </div>
      )}
    <div className="relative mx-auto max-w-4xl px-4 py-8 space-y-8">
      {canPreview && !isNovelPublic(novel.status) && (
        <PreviewBanner>
          นักอ่านยังไม่เห็นเรื่องนี้ <NovelStatusBadge status={novel.status} />
        </PreviewBanner>
      )}
      <div className="novel-hero flex flex-col gap-6 sm:flex-row">
        <Cover coverKey={novel.coverKey} title={novel.title} className="w-40 self-center sm:self-start" />
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold">{novel.title}</h1>
            <RatingBadge rating={novel.rating} />
          </div>
          <p className="text-muted">
            โดย <span className="font-semibold">{novel.author}</span>
            {novel.category && <> · {novel.category}</>}
            {" · "}
            {novel.status === "completed" ? "จบแล้ว" : "ยังไม่จบ"}
          </p>
          {tags.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <li key={t} className="tag-chip">
                  #{t}
                </li>
              ))}
            </ul>
          )}
          {novel.synopsis && <p className="whitespace-pre-line leading-relaxed">{novel.synopsis}</p>}
          {gate === "ok" && (
            <div className="flex flex-wrap items-center gap-2">
              {resume ? (
                <Link to={`/novel/${novel.id}/chapter/${resume.id}`} className={primaryButton}>
                  อ่านต่อ ตอนที่ {resume.number}
                </Link>
              ) : (
                first && (
                  <Link to={`/novel/${novel.id}/chapter/${first.id}`} className={primaryButton}>
                    เริ่มอ่านตอนแรก
                  </Link>
                )
              )}
              {isNovelPublic(novel.status) && (
                <ShelfButton saved={!!entry?.saved} loggedIn={loggedIn} novelId={novel.id} />
              )}
            </div>
          )}
        </div>
      </div>

      {gate !== "ok" ? (
        <AgeGateNotice gate={gate} redirectTo={`/novel/${novel.id}`} />
      ) : (
        <section>
          <h2 className="section-title mb-3">สารบัญ ({list.filter((c) => c.live).length} ตอน)</h2>
          {list.length === 0 ? (
            <p className="text-muted">ยังไม่มีตอนที่เผยแพร่</p>
          ) : (
            <ol className="card divide-y divide-line overflow-hidden">
              {list.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/novel/${novel.id}/chapter/${c.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-subtle"
                  >
                    <span className="w-10 text-sm text-muted">{c.number}</span>
                    <span className="flex-1">{c.title}</span>
                    {c.id === resume?.id && <span className="badge badge-info">อ่านล่าสุด</span>}
                    {!c.live && <ChapterStatusBadge status={c.status} live={false} />}
                    {c.live && c.publishAt && (
                      <span className="text-xs text-muted">{formatThaiDate(c.publishAt)}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
    </div>
  );
}
