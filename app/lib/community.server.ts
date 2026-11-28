import { and, asc, count, desc, eq, or } from "drizzle-orm";

import { getDb } from "~/db/client";
import { chapterLikes, chapters, comments, users } from "~/db/schema";
import { commentCooldownLeft } from "~/lib/community";

export async function getChapterLikes(chapterId: number, userId: string | null) {
  const db = getDb();
  const [{ n }] = await db.select({ n: count() }).from(chapterLikes).where(eq(chapterLikes.chapterId, chapterId));
  let liked = false;
  if (userId) {
    const [row] = await db
      .select({ userId: chapterLikes.userId })
      .from(chapterLikes)
      .where(and(eq(chapterLikes.chapterId, chapterId), eq(chapterLikes.userId, userId)));
    liked = !!row;
  }
  return { count: n, liked };
}

export async function setChapterLike(userId: string, chapterId: number, like: boolean) {
  const db = getDb();
  if (like) await db.insert(chapterLikes).values({ userId, chapterId }).onConflictDoNothing();
  else await db.delete(chapterLikes).where(and(eq(chapterLikes.userId, userId), eq(chapterLikes.chapterId, chapterId)));
}

/** ยอดถูกใจรวมทุกตอนของเรื่อง */
export async function getNovelLikeCount(novelId: number) {
  const [{ n }] = await getDb()
    .select({ n: count() })
    .from(chapterLikes)
    .innerJoin(chapters, eq(chapterLikes.chapterId, chapters.id))
    .where(eq(chapters.novelId, novelId));
  return n;
}

/**
 * คอมเมนต์ของตอน: คนทั่วไปเห็นเฉพาะที่ไม่ถูกซ่อน
 * เจ้าของคอมเมนต์เห็นของตัวเองที่ถูกซ่อน (พร้อมป้าย) admin เห็นทั้งหมด
 */
export async function listChapterComments(chapterId: number, viewer: { id: string; role: string } | null) {
  const isAdmin = viewer?.role === "admin";
  const visibility = isAdmin
    ? undefined
    : viewer
      ? or(eq(comments.status, "visible"), eq(comments.userId, viewer.id))
      : eq(comments.status, "visible");
  return getDb()
    .select({
      id: comments.id,
      body: comments.body,
      status: comments.status,
      hiddenReason: comments.hiddenReason,
      createdAt: comments.createdAt,
      userId: comments.userId,
      author: users.displayName,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(and(eq(comments.chapterId, chapterId), visibility))
    .orderBy(asc(comments.createdAt), asc(comments.id))
    .limit(300);
}

export async function addComment(userId: string, chapterId: number, body: string) {
  const db = getDb();
  const [last] = await db
    .select({ createdAt: comments.createdAt })
    .from(comments)
    .where(eq(comments.userId, userId))
    .orderBy(desc(comments.createdAt))
    .limit(1);
  const wait = commentCooldownLeft(last?.createdAt ?? null);
  if (wait > 0) return { error: `ส่งคอมเมนต์ถี่เกินไป รออีก ${wait} วินาที` };
  await db.insert(comments).values({ userId, chapterId, body });
  return { ok: true as const };
}

/** ลบคอมเมนต์ของตัวเอง */
export async function deleteOwnComment(userId: string, commentId: number) {
  await getDb()
    .delete(comments)
    .where(and(eq(comments.id, commentId), eq(comments.userId, userId)));
}

/** admin ซ่อนหรือเลิกซ่อนคอมเมนต์ (ไม่ลบ เก็บไว้เป็นหลักฐาน) */
export async function setCommentHidden(commentId: number, adminId: string, hidden: boolean, reason = "") {
  await getDb()
    .update(comments)
    .set(
      hidden
        ? { status: "hidden", hiddenBy: adminId, hiddenReason: reason.trim().slice(0, 200) || null, updatedAt: new Date() }
        : { status: "visible", hiddenBy: null, hiddenReason: null, updatedAt: new Date() },
    )
    .where(eq(comments.id, commentId));
}
