import { eq, isNotNull, and } from "drizzle-orm";

import { getDb } from "~/db/client";
import { novels, users } from "~/db/schema";
import { deleteCover } from "~/lib/novel/cover.server";

/**
 * ลบบัญชีและข้อมูลทั้งหมดของผู้ใช้ (สิทธิ์ขอลบข้อมูลตาม PDPA)
 * - นิยายที่เขียนถูกลบ พร้อมตอน คอมเมนต์ และยอดถูกใจของตอนเหล่านั้น (cascade)
 * - session, บัญชี Google/LINE ที่เชื่อม, ชั้นหนังสือ, ยอดถูกใจและคอมเมนต์ของผู้ใช้ถูกลบ (cascade)
 * - ประวัติการอนุมัติ/ซ่อนที่ผู้ใช้เคยทำในฐานะ admin เหลือไว้แต่ไม่ระบุว่าใครทำ
 */
export async function deleteAccount(userId: string) {
  const db = getDb();
  const owned = await db
    .select({ coverKey: novels.coverKey })
    .from(novels)
    .where(and(eq(novels.authorId, userId), isNotNull(novels.coverKey)));
  await db.batch([
    db.update(novels).set({ reviewedBy: null }).where(eq(novels.reviewedBy, userId)),
    db.delete(novels).where(eq(novels.authorId, userId)),
    db.delete(users).where(eq(users.id, userId)),
  ]);
  await Promise.all(owned.map((n) => (n.coverKey ? deleteCover(n.coverKey) : undefined)));
}
