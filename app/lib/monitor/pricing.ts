/**
 * ราคาและโควตาของ Cloudflare (ตรวจจากหน้า docs เมื่อ 2026-11-28)
 * - Workers: https://developers.cloudflare.com/workers/platform/pricing/
 * - D1: https://developers.cloudflare.com/d1/platform/pricing/
 * - R2: https://developers.cloudflare.com/r2/pricing/
 * ถ้า Cloudflare เปลี่ยนราคา แก้ตัวเลขในไฟล์นี้ที่เดียว
 */

export type Plan = "free" | "paid";

export function parsePlan(v: string | undefined): Plan {
  return v?.trim().toLowerCase() === "paid" ? "paid" : "free";
}

/** โควตารายวันของแผน Workers Free รีเซ็ตทุกเที่ยงคืน UTC (07:00 เวลาไทย) เกินแล้วจะใช้งานไม่ได้จนรีเซ็ต */
export const FREE_DAILY = {
  workerRequests: 100_000,
  d1RowsRead: 5_000_000,
  d1RowsWritten: 100_000,
} as const;

/** CPU ต่อ request ของแผน Free เกินแล้วจะได้ error 1102 */
export const FREE_CPU_MS_PER_REQUEST = 10;

/** พื้นที่ D1 ที่ใช้ได้ฟรี และที่รวมอยู่ในแผน Paid */
export const D1_STORAGE_INCLUDED_GB = 5;

/** แผน Workers Paid ขั้นต่ำต่อเดือน (USD) */
export const PAID_BASE_USD = 5;

type Meter = {
  key: keyof MonthlyUsage;
  label: string;
  unit: string;
  /** ที่รวมในแผน Paid ต่อเดือน */
  paidIncluded: number;
  /** ราคาต่อ 1 หน่วยที่เกิน (USD) */
  pricePerUnit: number;
  /** หน่วยที่ใช้คิดราคา เช่น 1_000_000 = ราคาต่อล้าน */
  per: number;
  /** R2 คิดเงินแยกจากแผน Workers จึงเสียเงินได้แม้อยู่แผน Free */
  billedOnFree: boolean;
  /** โควตาฟรีต่อเดือน (เฉพาะที่ billedOnFree) */
  freeIncluded?: number;
};

export type MonthlyUsage = {
  workerRequests: number;
  workerCpuMs: number;
  d1RowsRead: number;
  d1RowsWritten: number;
  d1StorageGb: number;
  r2StorageGb: number;
  r2ClassA: number;
  r2ClassB: number;
};

export const METERS: Meter[] = [
  { key: "workerRequests", label: "Workers requests", unit: "ครั้ง", paidIncluded: 10_000_000, pricePerUnit: 0.3, per: 1_000_000, billedOnFree: false },
  { key: "workerCpuMs", label: "Workers CPU time", unit: "ms", paidIncluded: 30_000_000, pricePerUnit: 0.02, per: 1_000_000, billedOnFree: false },
  { key: "d1RowsRead", label: "D1 rows read", unit: "แถว", paidIncluded: 25_000_000_000, pricePerUnit: 0.001, per: 1_000_000, billedOnFree: false },
  { key: "d1RowsWritten", label: "D1 rows written", unit: "แถว", paidIncluded: 50_000_000, pricePerUnit: 1, per: 1_000_000, billedOnFree: false },
  { key: "d1StorageGb", label: "D1 storage", unit: "GB", paidIncluded: D1_STORAGE_INCLUDED_GB, pricePerUnit: 0.75, per: 1, billedOnFree: false },
  { key: "r2StorageGb", label: "R2 storage", unit: "GB-เดือน", paidIncluded: 10, freeIncluded: 10, pricePerUnit: 0.015, per: 1, billedOnFree: true },
  { key: "r2ClassA", label: "R2 Class A (อัปโหลด/ลิสต์)", unit: "ครั้ง", paidIncluded: 1_000_000, freeIncluded: 1_000_000, pricePerUnit: 4.5, per: 1_000_000, billedOnFree: true },
  { key: "r2ClassB", label: "R2 Class B (อ่านไฟล์)", unit: "ครั้ง", paidIncluded: 10_000_000, freeIncluded: 10_000_000, pricePerUnit: 0.36, per: 1_000_000, billedOnFree: true },
];

export type CostLine = {
  key: keyof MonthlyUsage;
  label: string;
  unit: string;
  usage: number;
  included: number | null;
  cost: number;
};

export type CostEstimate = { plan: Plan; base: number; lines: CostLine[]; total: number };

/** ประมาณค่าใช้จ่ายต่อเดือน (USD) จากปริมาณการใช้ต่อเดือน */
export function estimateMonthlyCost(usage: MonthlyUsage, plan: Plan): CostEstimate {
  const base = plan === "paid" ? PAID_BASE_USD : 0;
  const lines = METERS.map((m): CostLine => {
    const value = Math.max(0, usage[m.key] || 0);
    // แผน Free: Workers/D1 ไม่เสียเงิน แต่จะหยุดทำงานถ้าเกินโควตารายวัน
    const included = plan === "paid" ? m.paidIncluded : m.billedOnFree ? (m.freeIncluded ?? 0) : null;
    const cost = included === null ? 0 : (Math.max(0, value - included) / m.per) * m.pricePerUnit;
    return { key: m.key, label: m.label, unit: m.unit, usage: value, included, cost };
  });
  const total = base + lines.reduce((s, l) => s + l.cost, 0);
  return { plan, base, lines, total };
}

/** แยกชนิดการเรียก R2 เป็น Class A / B / ฟรี ตามหน้าราคา R2 */
const R2_CLASS_A = new Set([
  "ListBuckets", "PutBucket", "ListObjects", "PutObject", "CopyObject", "CompleteMultipartUpload",
  "CreateMultipartUpload", "LifecycleStorageTierTransition", "ListMultipartUploads", "UploadPart",
  "UploadPartCopy", "ListParts", "PutBucketEncryption", "PutBucketCors", "PutBucketLifecycleConfiguration",
]);
const R2_FREE = new Set(["DeleteObject", "DeleteObjects", "DeleteBucket", "AbortMultipartUpload"]);

export function r2OperationClass(actionType: string): "A" | "B" | "free" {
  if (R2_CLASS_A.has(actionType)) return "A";
  if (R2_FREE.has(actionType)) return "free";
  return "B";
}

/**
 * ขยายยอดที่เก็บมา N วันให้เป็นยอด 30 วัน
 * daysCovered นับวันที่มีข้อมูลจริง (วันนี้นับเป็นเศษส่วนของวันที่ผ่านไปแล้ว)
 * ถ้ามีข้อมูลไม่ถึงครึ่งวันจะยังไม่ขยาย เพราะตัวเลขจะเพี้ยนมาก
 */
export function projectToMonth(total: number, daysCovered: number): number {
  if (daysCovered < 0.5) return total;
  return (total / daysCovered) * 30;
}

/** ร้อยละของโควตา ตัดที่ 0 */
export function percentOf(value: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.max(0, (value / limit) * 100);
}

export type Level = "ok" | "warn" | "danger";

/** เกิน 80% = เตือน, เกิน 100% = เกินแล้ว */
export function usageLevel(pct: number): Level {
  if (pct >= 100) return "danger";
  if (pct >= 80) return "warn";
  return "ok";
}
