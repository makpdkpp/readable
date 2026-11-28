export const PASSWORD_MIN = 8;

export function normalizeEmail(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `รหัสผ่านต้องยาวอย่างน้อย ${PASSWORD_MIN} ตัวอักษร`;
  if (password.length > 200) return "รหัสผ่านยาวเกินไป";
  return null;
}

export function validateDisplayName(name: string): string | null {
  if (name.length < 2) return "นามปากกาต้องยาวอย่างน้อย 2 ตัวอักษร";
  if (name.length > 50) return "นามปากกายาวได้ไม่เกิน 50 ตัวอักษร";
  return null;
}

/** วันเกิดรูปแบบ YYYY-MM-DD ที่มีอยู่จริงและไม่อยู่ในอนาคต */
export function isValidBirthDate(value: string, today = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return false;
  return d <= today && d.getUTCFullYear() >= 1900;
}

/** กันการส่งต่อไปเว็บอื่น (open redirect) ยอมเฉพาะ path ภายในเว็บเรา */
export function safeRedirect(to: unknown, fallback = "/"): string {
  if (typeof to !== "string" || to.length > 2000) return fallback;
  // เบราว์เซอร์ตัด tab/ขึ้นบรรทัดทิ้งก่อนอ่าน URL: "/<tab>/evil.com" จะกลายเป็น "//evil.com"
  // จึงไม่รับตัวอักษรควบคุมและช่องว่างเลย
  if (/[\u0000-\u0020\u007f\\]/.test(to)) return fallback;
  if (!to.startsWith("/") || to.startsWith("//")) return fallback;
  return to;
}
