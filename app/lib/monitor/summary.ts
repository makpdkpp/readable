import type { CloudflareUsage } from "./cloudflare.server";
import { FREE_DAILY, type MonthlyUsage, projectToMonth } from "./pricing";

const DAY_MS = 86_400_000;
const GB = 1_000_000_000;

export type UsageSummary = {
  /** ยอดของวันนี้ (นับตั้งแต่เที่ยงคืน UTC) เทียบกับโควตารายวันของแผน Free */
  today: {
    workerRequests: number | null;
    workerErrors: number | null;
    cpuP99Ms: number | null;
    d1RowsRead: number | null;
    d1RowsWritten: number | null;
  };
  /** ยอดจริงในช่วงที่ดึงมา (ไม่เกิน 30 วัน) */
  period: { days: number; workerRequests: number; workerErrors: number };
  /** ประมาณการต่อเดือน (30 วัน) ใช้คิดค่าใช้จ่าย */
  monthly: MonthlyUsage;
  /** วันที่ใช้ถึงโควตารายวันมากที่สุดในช่วงนี้ (ร้อยละ) */
  peakDailyPct: { workerRequests: number; d1RowsRead: number; d1RowsWritten: number };
};

/** จำนวนวันที่มีข้อมูล: จากวันแรกที่มีข้อมูลถึงตอนนี้ (วันนี้นับเป็นเศษ) */
export function daysCovered(dates: string[], now: Date): number {
  if (dates.length === 0) return 0;
  const first = Math.min(...dates.map((d) => Date.parse(`${d}T00:00:00Z`)));
  return Math.max(0, (now.getTime() - first) / DAY_MS);
}

export function summarizeUsage(usage: CloudflareUsage | null, d1SizeBytes: number | null, now: Date): UsageSummary {
  const today = now.toISOString().slice(0, 10);
  const wDays = usage?.workers.ok ? usage.workers.data.days : [];
  const dDays = usage?.d1.ok ? usage.d1.data.days : [];
  const r2 = usage?.r2.ok ? usage.r2.data : null;

  const wToday = wDays.find((d) => d.date === today);
  const dToday = dDays.find((d) => d.date === today);

  const covered = daysCovered([...wDays, ...dDays].map((d) => d.date), now);
  // R2 ไม่มียอดรายวัน ใช้จำนวนวันเดียวกับ Workers/D1 ถ้าไม่มีให้ถือว่าครบ 30 วัน
  const r2Covered = covered > 0 ? covered : 30;
  const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);

  const requests = sum(wDays, (d) => d.requests);
  // ประมาณ CPU รวม = requests × CPU กลาง (p50) ของแต่ละวัน
  const cpuMs = sum(wDays, (d) => d.requests * d.cpuP50Ms);

  return {
    today: {
      workerRequests: usage?.workers.ok ? (wToday?.requests ?? 0) : null,
      workerErrors: usage?.workers.ok ? (wToday?.errors ?? 0) : null,
      cpuP99Ms: wToday ? wToday.cpuP99Ms : null,
      d1RowsRead: usage?.d1.ok ? (dToday?.rowsRead ?? 0) : null,
      d1RowsWritten: usage?.d1.ok ? (dToday?.rowsWritten ?? 0) : null,
    },
    period: { days: Math.ceil(covered), workerRequests: requests, workerErrors: sum(wDays, (d) => d.errors) },
    monthly: {
      workerRequests: projectToMonth(requests, covered),
      workerCpuMs: projectToMonth(cpuMs, covered),
      d1RowsRead: projectToMonth(sum(dDays, (d) => d.rowsRead), covered),
      d1RowsWritten: projectToMonth(sum(dDays, (d) => d.rowsWritten), covered),
      d1StorageGb: (d1SizeBytes ?? 0) / GB,
      r2StorageGb: (r2?.storageBytes ?? 0) / GB,
      r2ClassA: projectToMonth(r2?.classA ?? 0, r2Covered),
      r2ClassB: projectToMonth(r2?.classB ?? 0, r2Covered),
    },
    peakDailyPct: {
      workerRequests: Math.max(0, ...wDays.map((d) => (d.requests / FREE_DAILY.workerRequests) * 100)),
      d1RowsRead: Math.max(0, ...dDays.map((d) => (d.rowsRead / FREE_DAILY.d1RowsRead) * 100)),
      d1RowsWritten: Math.max(0, ...dDays.map((d) => (d.rowsWritten / FREE_DAILY.d1RowsWritten) * 100)),
    },
  };
}

/** เติมวันที่ไม่มีคนสมัครให้เป็น 0 เรียงจากเก่าไปใหม่ (วันตามเวลาไทย) */
export function fillDays(rows: { day: string; n: number }[], now: Date, days: number) {
  const map = new Map(rows.map((r) => [r.day, r.n]));
  const DAY = DAY_MS;
  const out: { day: string; n: number }[] = [];
  const bkk = new Date(now.getTime() + 7 * 3600_000);
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(bkk.getTime() - i * DAY).toISOString().slice(0, 10);
    out.push({ day, n: map.get(day) ?? 0 });
  }
  return out;
}
