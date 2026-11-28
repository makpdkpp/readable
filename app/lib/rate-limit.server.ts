import { env } from "cloudflare:workers";

/**
 * จำกัดจำนวนครั้งด้วย Rate Limiting ของ Cloudflare (ตั้งค่าใน wrangler.jsonc ใช้ได้ในแผนฟรี)
 * - auth: ล็อกอิน/สมัคร/เปลี่ยนรหัสผ่าน 10 ครั้งต่อนาที กันเดารหัสผ่าน
 * - write: สร้างเรื่อง ตอน อัปโหลดปก ถูกใจ คอมเมนต์ 30 ครั้งต่อนาที กันสแปมและค่า R2/D1 บาน
 * นับแยกตามตำแหน่งของ Cloudflare และไม่แม่นยำ 100% แต่พอสำหรับกันการยิงรัวๆ
 * ถ้าไม่มี binding (เช่นรันทดสอบ) หรือระบบนับขัดข้อง จะปล่อยผ่าน ไม่ให้เว็บใช้ไม่ได้
 */
type Kind = "auth" | "write";

export async function isRateLimited(kind: Kind, key: string): Promise<boolean> {
  const limiter: RateLimit | undefined = kind === "auth" ? env.AUTH_LIMITER : env.WRITE_LIMITER;
  if (!limiter) return false;
  try {
    const { success } = await limiter.limit({ key: `${kind}:${key}` });
    return !success;
  } catch (e) {
    console.error("rate limiter", e);
    return false;
  }
}

/** true ถ้าคีย์ใดคีย์หนึ่งเกินโควตา (นับทุกคีย์เสมอ) */
export async function anyRateLimited(kind: Kind, keys: string[]): Promise<boolean> {
  const results = await Promise.all(keys.map((k) => isRateLimited(kind, k)));
  return results.some(Boolean);
}

export function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "local";
}

export const RATE_LIMIT_MESSAGE = "ทำรายการถี่เกินไป รอสักครู่แล้วลองใหม่";

/** ใช้ใน action ที่ไม่มีที่แสดงข้อความ: ตอบ 429 */
export async function assertNotRateLimited(kind: Kind, key: string) {
  if (await isRateLimited(kind, key)) {
    throw new Response(RATE_LIMIT_MESSAGE, { status: 429, headers: { "Retry-After": "60" } });
  }
}
