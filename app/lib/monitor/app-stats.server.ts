import { env } from "cloudflare:workers";
import { and, count, eq, gte, inArray, sql, sum } from "drizzle-orm";

import { getDb } from "~/db/client";
import { fillDays } from "./summary";
import { chapterLikes, chapters, comments, library, novels, sessions, users } from "~/db/schema";

const DAY = 86_400_000;

/** วัดความเร็ว D1 และขนาดฐานข้อมูล (D1 แนบขนาดมาใน meta ของทุก query) */
export async function pingD1(): Promise<{ ms: number; sizeBytes: number | null; error?: string }> {
  const t0 = Date.now();
  try {
    const r = await env.DB.prepare("select 1").run();
    const size = (r.meta as { size_after?: number }).size_after;
    return { ms: Date.now() - t0, sizeBytes: typeof size === "number" ? size : null };
  } catch (e) {
    return { ms: Date.now() - t0, sizeBytes: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** สถิติของเว็บจากฐานข้อมูลเอง ใช้ได้โดยไม่ต้องมี Cloudflare token */
export async function getAppStats(now = new Date()) {
  const db = getDb();
  const ago = (days: number) => new Date(now.getTime() - days * DAY);
  const one = async (q: Promise<{ n: number | string | null }[]>) => Number((await q)[0]?.n ?? 0);

  const [
    usersTotal, users1d, users7d, users30d,
    activeSessions, readers1d, readers7d,
    novelRows,
    chaptersPublished, wordsPublished, chapters7d,
    comments7d, likes7d, commentsHidden,
    signupRows,
  ] = await Promise.all([
    one(db.select({ n: count() }).from(users)),
    one(db.select({ n: count() }).from(users).where(gte(users.createdAt, ago(1)))),
    one(db.select({ n: count() }).from(users).where(gte(users.createdAt, ago(7)))),
    one(db.select({ n: count() }).from(users).where(gte(users.createdAt, ago(30)))),
    one(db.select({ n: sql<number>`count(distinct ${sessions.userId})` }).from(sessions).where(gte(sessions.expiresAt, now))),
    one(db.select({ n: sql<number>`count(distinct ${library.userId})` }).from(library).where(gte(library.lastReadAt, ago(1)))),
    one(db.select({ n: sql<number>`count(distinct ${library.userId})` }).from(library).where(gte(library.lastReadAt, ago(7)))),
    db.select({ status: novels.status, n: count() }).from(novels).groupBy(novels.status),
    one(db.select({ n: count() }).from(chapters).where(eq(chapters.status, "published"))),
    one(db.select({ n: sum(chapters.wordCount) }).from(chapters).where(eq(chapters.status, "published"))),
    one(
      db
        .select({ n: count() })
        .from(chapters)
        .where(and(inArray(chapters.status, ["published", "scheduled"]), gte(chapters.createdAt, ago(7)))),
    ),
    one(db.select({ n: count() }).from(comments).where(gte(comments.createdAt, ago(7)))),
    one(db.select({ n: count() }).from(chapterLikes).where(gte(chapterLikes.createdAt, ago(7)))),
    one(db.select({ n: count() }).from(comments).where(eq(comments.status, "hidden"))),
    // สมัครใหม่รายวัน 14 วันล่าสุด ตามวันเวลาไทย
    db
      .select({
        day: sql<string>`date(${users.createdAt} + 25200, 'unixepoch')`,
        n: count(),
      })
      .from(users)
      .where(gte(users.createdAt, ago(14)))
      .groupBy(sql`1`),
  ]);

  const byStatus = Object.fromEntries(novelRows.map((r) => [r.status, Number(r.n)])) as Record<string, number>;
  return {
    users: { total: usersTotal, new1d: users1d, new7d: users7d, new30d: users30d, activeSessions },
    readers: { d1: readers1d, d7: readers7d },
    novels: {
      published: (byStatus.ongoing ?? 0) + (byStatus.completed ?? 0),
      draft: byStatus.draft ?? 0,
      pendingReview: byStatus.pending_review ?? 0,
      hidden: byStatus.hidden ?? 0,
      total: Object.values(byStatus).reduce((s, n) => s + n, 0),
    },
    chapters: { published: chaptersPublished, words: wordsPublished, new7d: chapters7d },
    community: { comments7d, likes7d, commentsHidden },
    signups: fillDays(signupRows.map((r) => ({ day: r.day, n: Number(r.n) })), now, 14),
  };
}
