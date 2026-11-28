import { eq } from "drizzle-orm";

import { getDb } from "~/db/client";
import { categories, novels, users } from "~/db/schema";
import { getCurrentUser, type CurrentUser } from "~/lib/auth/session.server";
import { canRead, isNovelPublic } from "~/lib/moderation";

export type AgeGate = "ok" | "login" | "birthdate" | "underage";

function ageGate(rating: "all" | "13+" | "18+", viewer: CurrentUser | null): AgeGate {
  if (canRead(rating, viewer)) return "ok";
  if (!viewer) return "login";
  if (!viewer.birthDate) return "birthdate";
  return "underage";
}

/**
 * โหลดเรื่องสำหรับหน้าอ่าน
 * - เรื่องที่ยังไม่เผยแพร่ (ร่าง รออนุมัติ ถูกซ่อน) เห็นได้เฉพาะเจ้าของและ admin ที่เหลือได้ 404
 * - เรื่อง 18+ ต้องล็อกอินและอายุ 18 ขึ้นไป ยกเว้นเจ้าของเรื่องและ admin
 */
export async function loadNovelForReader(request: Request, novelIdParam: string | undefined) {
  const id = Number(novelIdParam);
  if (!Number.isInteger(id) || id <= 0) throw new Response("Not Found", { status: 404 });
  const viewer = await getCurrentUser(request);
  const [novel] = await getDb()
    .select({
      id: novels.id,
      authorId: novels.authorId,
      author: users.displayName,
      title: novels.title,
      synopsis: novels.synopsis,
      coverKey: novels.coverKey,
      rating: novels.rating,
      status: novels.status,
      category: categories.name,
      updatedAt: novels.updatedAt,
    })
    .from(novels)
    .innerJoin(users, eq(novels.authorId, users.id))
    .leftJoin(categories, eq(novels.categoryId, categories.id))
    .where(eq(novels.id, id))
    .limit(1);
  if (!novel) throw new Response("Not Found", { status: 404 });

  const isOwner = viewer?.id === novel.authorId;
  const isAdmin = viewer?.role === "admin";
  const preview = !isNovelPublic(novel.status);
  if (preview && !isOwner && !isAdmin) throw new Response("Not Found", { status: 404 });

  // เจ้าของเรื่องและ admin (ที่ต้องตรวจเนื้อหา) อ่านได้เสมอ
  const gate = isOwner || isAdmin ? "ok" : ageGate(novel.rating, viewer);
  return { novel, viewer, isOwner, isAdmin, canPreview: isOwner || isAdmin, gate };
}
