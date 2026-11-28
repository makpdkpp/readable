import { and, eq, inArray, lte, ne, or } from "drizzle-orm";

import type { Route } from "./+types/sitemap[.]xml";
import { getDb } from "~/db/client";
import { chapters, novels } from "~/db/schema";
import { PUBLIC_STATUSES } from "~/lib/moderation";
import { sitemapXml } from "~/lib/seo";

/** เรื่องที่เผยแพร่และไม่ใช่ 18+ พร้อมตอนที่ขึ้นเว็บแล้ว */
export async function loader({ request }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const db = getDb();
  const publicNovel = and(inArray(novels.status, [...PUBLIC_STATUSES]), ne(novels.rating, "18+"));
  const novelRows = await db
    .select({ id: novels.id, updatedAt: novels.updatedAt })
    .from(novels)
    .where(publicNovel)
    .limit(10000);
  const chapterRows = await db
    .select({ id: chapters.id, novelId: chapters.novelId, updatedAt: chapters.updatedAt })
    .from(chapters)
    .innerJoin(novels, eq(chapters.novelId, novels.id))
    .where(
      and(
        publicNovel,
        or(
          eq(chapters.status, "published"),
          and(eq(chapters.status, "scheduled"), lte(chapters.publishAt, new Date())),
        ),
      ),
    )
    .limit(40000);
  const xml = sitemapXml([
    { loc: `${origin}/` },
    ...novelRows.map((n) => ({ loc: `${origin}/novel/${n.id}`, lastmod: n.updatedAt })),
    ...chapterRows.map((c) => ({ loc: `${origin}/novel/${c.novelId}/chapter/${c.id}`, lastmod: c.updatedAt })),
  ]);
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
