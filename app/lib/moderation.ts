import type { ChapterStatus, NovelStatus, Rating } from "~/db/schema";

/**
 * สถานะที่เรื่องจะได้เมื่อนักเขียนกด "เผยแพร่"
 * เรื่อง 18+ ต้องรอ admin อนุมัติก่อน ส่วนเรตอื่นขึ้นเว็บได้ทันที
 * เรื่องที่ admin ไม่อนุมัติไปแล้ว ต้องกลับไปให้ admin ตรวจเสมอ แม้จะลดเรตลง
 * (ไม่อย่างนั้นแค่เปลี่ยนเรตเป็น "ทั่วไป" ก็ขึ้นเว็บได้โดยไม่ผ่านการตรวจ)
 */
export function statusOnPublish(rating: Rating, current: NovelStatus = "draft"): NovelStatus {
  if (current === "rejected") return "pending_review";
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

/** สถานะที่นักอ่านทั่วไปมองเห็นเรื่องได้ */
export const PUBLIC_STATUSES = ["ongoing", "completed"] as const satisfies readonly NovelStatus[];

export function isNovelPublic(status: NovelStatus): boolean {
  return (PUBLIC_STATUSES as readonly NovelStatus[]).includes(status);
}

/**
 * สถานะใหม่เมื่อนักเขียนแก้เรต
 * เรื่องที่ขึ้นเว็บแล้วถ้าเปลี่ยนเป็น 18+ ต้องกลับไปรอ admin อนุมัติ
 * เรื่องที่รออนุมัติอยู่แล้วเปลี่ยนเรตลงจาก 18+ ก็ขึ้นเว็บได้เลย
 */
export function statusOnRatingChange(
  status: NovelStatus,
  oldRating: Rating,
  newRating: Rating,
): NovelStatus {
  if (newRating === "18+" && oldRating !== "18+" && isNovelPublic(status)) return "pending_review";
  if (newRating !== "18+" && status === "pending_review") return "ongoing";
  return status;
}

/** ตอนที่ตั้งเวลาไว้จะนับว่าเผยแพร่แล้วเมื่อถึงเวลา ไม่ต้องรอ cron */
export function isChapterLive(
  chapter: { status: ChapterStatus; publishAt: Date | null },
  now = new Date(),
): boolean {
  if (chapter.status === "published") return true;
  return chapter.status === "scheduled" && !!chapter.publishAt && chapter.publishAt <= now;
}
