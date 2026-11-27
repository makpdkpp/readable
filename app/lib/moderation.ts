import type { NovelStatus, Rating } from "~/db/schema";

/**
 * สถานะที่เรื่องจะได้เมื่อนักเขียนกด "เผยแพร่"
 * เรื่อง 18+ ต้องรอ admin อนุมัติก่อน ส่วนเรตอื่นขึ้นเว็บได้ทันที
 */
export function statusOnPublish(rating: Rating): NovelStatus {
  return rating === "18+" ? "pending_review" : "ongoing";
}

/** อายุเต็มปี ณ วันที่ `today` จากวันเกิดรูปแบบ YYYY-MM-DD */
export function ageOn(birthDate: string, today: Date): number {
  const [y, m, d] = birthDate.split("-").map(Number);
  let age = today.getUTCFullYear() - y;
  const beforeBirthday =
    today.getUTCMonth() + 1 < m ||
    (today.getUTCMonth() + 1 === m && today.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

/** นักอ่านเปิดอ่านเรื่องเรตนี้ได้ไหม (เรื่อง 18+ ต้องล็อกอินและอายุ 18 ขึ้นไป) */
export function canRead(
  rating: Rating,
  reader: { birthDate: string | null } | null,
  today = new Date(),
): boolean {
  if (rating !== "18+") return true;
  if (!reader?.birthDate) return false;
  return ageOn(reader.birthDate, today) >= 18;
}
