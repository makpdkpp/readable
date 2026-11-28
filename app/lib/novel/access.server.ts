import { and, asc, eq, inArray } from "drizzle-orm";

import { getDb } from "~/db/client";
import { categories, chapters, novels, novelTags, tags, users } from "~/db/schema";
import type { CurrentUser } from "~/lib/auth/session.server";

/** โหลดเรื่องของนักเขียนคนนี้ ถ้าไม่ใช่เจ้าของจะได้ 404 (ไม่บอกว่ามีเรื่องนี้อยู่) */
export async function requireOwnNovel(user: CurrentUser, novelIdParam: string | undefined) {
  const id = Number(novelIdParam);
  if (!Number.isInteger(id) || id <= 0) throw new Response("Not Found", { status: 404 });
  const [novel] = await getDb()
    .select()
    .from(novels)
    .where(and(eq(novels.id, id), eq(novels.authorId, user.id)))
    .limit(1);
  if (!novel) throw new Response("Not Found", { status: 404 });
  return novel;
}

export async function requireOwnChapter(novelId: number, chapterIdParam: string | undefined) {
  const id = Number(chapterIdParam);
  if (!Number.isInteger(id) || id <= 0) throw new Response("Not Found", { status: 404 });
  const [chapter] = await getDb()
    .select()
    .from(chapters)
    .where(and(eq(chapters.id, id), eq(chapters.novelId, novelId)))
    .limit(1);
  if (!chapter) throw new Response("Not Found", { status: 404 });
  return chapter;
}

export async function listCategories() {
  return getDb()
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.id));
}

export async function getNovelTags(novelId: number): Promise<string[]> {
  const rows = await getDb()
    .select({ name: tags.name })
    .from(novelTags)
    .innerJoin(tags, eq(novelTags.tagId, tags.id))
    .where(eq(novelTags.novelId, novelId));
  return rows.map((r) => r.name);
}

/** แทนแท็กทั้งหมดของเรื่องด้วยชุดใหม่ */
export async function setNovelTags(novelId: number, names: string[]) {
  const db = getDb();
  await db.delete(novelTags).where(eq(novelTags.novelId, novelId));
  if (names.length === 0) return;
  await db
    .insert(tags)
    .values(names.map((name) => ({ name })))
    .onConflictDoNothing();
  const rows = await db.select({ id: tags.id }).from(tags).where(inArray(tags.name, names));
  await db
    .insert(novelTags)
    .values(rows.map((r) => ({ novelId, tagId: r.id })))
    .onConflictDoNothing();
}

export async function getAuthorName(userId: string) {
  const [row] = await getDb()
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId));
  return row?.displayName ?? "";
}

export function requireAdmin(user: CurrentUser) {
  if (user.role !== "admin") throw new Response("Not Found", { status: 404 });
}
