/** "A@x.com, b@y.com" → Set { "a@x.com", "b@y.com" } */
export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[,\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@")),
  );
}

export const ROLES = ["reader", "writer", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = { reader: "นักอ่าน", writer: "นักเขียน", admin: "แอดมิน" };

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

/**
 * ตรวจว่าเปลี่ยนสิทธิ์ได้ไหม คืนข้อความผิดพลาด หรือ null ถ้าทำได้
 * - ห้ามลดสิทธิ์ตัวเอง กัน admin คนสุดท้ายล็อกตัวเองออก
 * - คนที่อยู่ใน ADMIN_EMAILS จะกลับเป็น admin ทุกครั้งที่เข้าเว็บ ลดสิทธิ์ไปก็ไม่มีผล
 */
export function roleChangeError(
  actor: { id: string },
  target: { id: string; email: string },
  newRole: Role,
  adminEmails: Set<string>,
): string | null {
  if (actor.id === target.id && newRole !== "admin") return "ลดสิทธิ์ตัวเองไม่ได้ ให้ admin คนอื่นทำแทน";
  if (newRole !== "admin" && adminEmails.has(target.email.toLowerCase()))
    return "อีเมลนี้อยู่ใน ADMIN_EMAILS ต้องเอาออกจากการตั้งค่าใน Cloudflare ก่อน";
  return null;
}
