import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { getDb } from "~/db/client";
import { chapters, library, novels, users } from "~/db/schema";
import { PUBLIC_STATUSES } from "~/lib/moderation";

/** จำว่าผู้ใช้อ่านถึงตอนไหน เรียกทุกครั้งที่เปิดหน้าอ่านตอน */
export async function recordRead(userId: string, novelId: number, chapterId: number) {
  const now = new Date();
  await getDb()
    .insert(library)
    .values({ userId, novelId, lastChapterId: chapterId, lastReadAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [library.userId, library.novelId],
      set: { lastChapterId: chapterId, lastReadAt: now, updatedAt: now },
    });
}

export async function getLibraryEntry(userId: string, novelId: number) {
  const [row] = await getDb()
    .select({
      saved: library.saved,
      lastChapterId: library.lastChapterId,
      lastChapterNumber: chapters.number,
      lastChapterTitle: chapters.title,
    })
    .from(library)
    .leftJoin(chapters, eq(library.lastChapterId, chapters.id))
    .where(and(eq(library.userId, userId), eq(library.novelId, novelId)));
  return row ?? null;
}

export async function setSaved(userId: string, novelId: number, saved: boolean) {
  const now = new Date();
  const savedAt = saved ? now : null;
  await getDb()
    .insert(library)
    .values({ userId, novelId, saved, savedAt, updatedAt: now })
    .onConflictDoUpdate({
      target: [library.userId, library.novelId],
      set: { saved, savedAt, updatedAt: now },
    });
}

/** ลบเรื่องออกจากประวัติการอ่าน (ถ้ายังอยู่ในชั้นหนังสือ แถวจะยังอยู่แต่ไม่ขึ้นในประวัติ) */
export async function removeFromHistory(userId: string, novelId: number) {
  const db = getDb();
  const where = and(eq(library.userId, userId), eq(library.novelId, novelId));
  await db.update(library).set({ lastReadAt: null, lastChapterId: null, updatedAt: new Date() }).where(where);
  await db.delete(library).where(and(where, eq(library.saved, false)));
}

export async function clearHistory(userId: string) {
  const db = getDb();
  await db
    .update(library)
    .set({ lastReadAt: null, lastChapterId: null, updatedAt: new Date() })
    .where(eq(library.userId, userId));
  await db.delete(library).where(and(eq(library.userId, userId), eq(library.saved, false)));
}

/** จำนวนตอนที่นักอ่านเห็นแล้ว ใช้กฎเดียวกับ isChapterLive */
const liveChapterCount = sql<number>`(
  select count(*) from ${chapters}
  where ${chapters.novelId} = ${novels.id}
    and (${chapters.status} = 'published'
      or (${chapters.status} = 'scheduled' and ${chapters.publishAt} <= unixepoch()))
)`;

/** ตอนที่ขึ้นเว็บแล้วหลังจากตอนที่อ่านล่าสุด ("chapters" ในคำสั่งนี้คือตอนที่อ่านล่าสุดที่ join ไว้) */
const newChapterCount = sql<number>`(
  select count(*) from chapters c2
  where c2.novel_id = "novels"."id"
    and (c2.status = 'published' or (c2.status = 'scheduled' and c2.publish_at <= unixepoch()))
    and c2.number > "chapters"."number"
)`;

export async function listLibrary(userId: string, view: "shelf" | "history") {
  const rows = await getDb()
    .select({
      novelId: novels.id,
      title: novels.title,
      coverKey: novels.coverKey,
      rating: novels.rating,
      status: novels.status,
      author: users.displayName,
      saved: library.saved,
      lastReadAt: library.lastReadAt,
      lastChapterId: library.lastChapterId,
      lastChapterNumber: chapters.number,
      lastChapterTitle: chapters.title,
      liveChapters: liveChapterCount,
      newChapters: newChapterCount,
    })
    .from(library)
    .innerJoin(novels, eq(library.novelId, novels.id))
    .innerJoin(users, eq(novels.authorId, users.id))
    .leftJoin(chapters, eq(library.lastChapterId, chapters.id))
    .where(
      and(
        eq(library.userId, userId),
        view === "shelf" ? eq(library.saved, true) : isNotNull(library.lastReadAt),
        // เรื่องที่ถูกซ่อนหรือกลับไปรออนุมัติจะหายไปจากชั้นชั่วคราว
        inArray(novels.status, [...PUBLIC_STATUSES]),
      ),
    )
    .orderBy(view === "shelf" ? desc(library.savedAt) : desc(library.lastReadAt))
    .limit(200);
  return rows;
}
