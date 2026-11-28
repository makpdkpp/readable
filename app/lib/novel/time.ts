// ผู้ใช้อยู่ไทยทั้งหมด เวลาที่กรอกและแสดงจึงเป็นเวลาไทย (UTC+7 ไม่มี daylight saving)
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** "2026-11-28T20:00" (เวลาไทยจาก <input type="datetime-local">) → Date */
export function parseBangkokLocal(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → ค่าสำหรับ <input type="datetime-local"> ในเวลาไทย */
export function toBangkokLocal(d: Date): string {
  return new Date(d.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 16);
}

export function formatThaiDateTime(d: Date | number | string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(d));
}

export function formatThaiDate(d: Date | number | string): string {
  return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium" }).format(
    new Date(d),
  );
}
