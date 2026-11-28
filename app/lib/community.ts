export const COMMENT_MAX = 1000;
/** เว้นระยะระหว่างคอมเมนต์ของผู้ใช้คนเดียว กันสแปมแบบง่าย ๆ */
export const COMMENT_COOLDOWN_SECONDS = 10;

/** ตัดช่องว่างหัวท้าย ยุบบรรทัดว่างที่ติดกันเกิน 2 บรรทัด แล้วตรวจความยาว */
export function parseCommentBody(raw: unknown): { body: string } | { error: string } {
  const body = String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!body) return { error: "พิมพ์คอมเมนต์ก่อนส่ง" };
  if ([...body].length > COMMENT_MAX) return { error: `คอมเมนต์ยาวได้ไม่เกิน ${COMMENT_MAX} ตัวอักษร` };
  return { body };
}

/** เหลือเวลาอีกกี่วินาทีจึงคอมเมนต์ได้อีก (0 = ส่งได้เลย) */
export function commentCooldownLeft(lastAt: Date | null, now = new Date()): number {
  if (!lastAt) return 0;
  const left = COMMENT_COOLDOWN_SECONDS - Math.floor((now.getTime() - lastAt.getTime()) / 1000);
  return Math.max(0, left);
}
