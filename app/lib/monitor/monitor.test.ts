import { describe, expect, it } from "vitest";

import type { CloudflareUsage } from "./cloudflare.server";
import {
  type MonthlyUsage,
  estimateMonthlyCost,
  parsePlan,
  projectToMonth,
  r2OperationClass,
  usageLevel,
} from "./pricing";
import { daysCovered, fillDays, summarizeUsage } from "./summary";

const zero: MonthlyUsage = {
  workerRequests: 0,
  workerCpuMs: 0,
  d1RowsRead: 0,
  d1RowsWritten: 0,
  d1StorageGb: 0,
  r2StorageGb: 0,
  r2ClassA: 0,
  r2ClassB: 0,
};

describe("estimateMonthlyCost", () => {
  it("แผน Free ใช้น้อย = 0 บาท", () => {
    expect(estimateMonthlyCost({ ...zero, workerRequests: 50_000_000 }, "free").total).toBe(0);
  });
  it("แผน Free ยังเสียค่า R2 ถ้าเกินโควตาฟรี", () => {
    const c = estimateMonthlyCost({ ...zero, r2StorageGb: 20, r2ClassA: 2_000_000 }, "free");
    expect(c.total).toBeCloseTo(10 * 0.015 + 4.5);
  });
  it("แผน Paid = $5 + ส่วนที่เกิน", () => {
    const c = estimateMonthlyCost(
      { ...zero, workerRequests: 12_000_000, workerCpuMs: 40_000_000, d1RowsWritten: 51_000_000, d1StorageGb: 6 },
      "paid",
    );
    expect(c.total).toBeCloseTo(5 + 0.6 + 0.2 + 1 + 0.75);
  });
  it("แผน Paid ใช้ในโควตา = $5", () => {
    expect(estimateMonthlyCost({ ...zero, workerRequests: 1000 }, "paid").total).toBe(5);
  });
});

describe("helpers", () => {
  it("parsePlan", () => {
    expect(parsePlan(" Paid ")).toBe("paid");
    expect(parsePlan(undefined)).toBe("free");
    expect(parsePlan("pro")).toBe("free");
  });
  it("r2OperationClass", () => {
    expect(r2OperationClass("PutObject")).toBe("A");
    expect(r2OperationClass("GetObject")).toBe("B");
    expect(r2OperationClass("DeleteObject")).toBe("free");
  });
  it("projectToMonth ไม่ขยายถ้ามีข้อมูลไม่ถึงครึ่งวัน", () => {
    expect(projectToMonth(100, 0.2)).toBe(100);
    expect(projectToMonth(100, 10)).toBe(300);
  });
  it("usageLevel", () => {
    expect(usageLevel(50)).toBe("ok");
    expect(usageLevel(80)).toBe("warn");
    expect(usageLevel(120)).toBe("danger");
  });
  it("daysCovered นับวันนี้เป็นเศษ", () => {
    expect(daysCovered(["2026-11-27", "2026-11-28"], new Date("2026-11-28T12:00:00Z"))).toBeCloseTo(1.5);
    expect(daysCovered([], new Date())).toBe(0);
  });
  it("fillDays เติมวันว่างตามเวลาไทย", () => {
    // 2026-11-28 20:00 UTC = 29 พ.ย. 03:00 เวลาไทย
    const out = fillDays([{ day: "2026-11-29", n: 3 }], new Date("2026-11-28T20:00:00Z"), 3);
    expect(out).toEqual([
      { day: "2026-11-27", n: 0 },
      { day: "2026-11-28", n: 0 },
      { day: "2026-11-29", n: 3 },
    ]);
  });
});

describe("summarizeUsage", () => {
  const now = new Date("2026-11-28T12:00:00Z");
  const usage: CloudflareUsage = {
    fetchedAt: now.toISOString(),
    rangeStart: "2026-10-30T00:00:00.000Z",
    workers: {
      ok: true,
      data: {
        days: [
          { date: "2026-11-27", requests: 1000, errors: 10, subrequests: 0, cpuP50Ms: 2, cpuP99Ms: 8 },
          { date: "2026-11-28", requests: 500, errors: 1, subrequests: 0, cpuP50Ms: 4, cpuP99Ms: 9 },
        ],
        statuses: [],
      },
    },
    d1: { ok: true, data: { days: [{ date: "2026-11-28", readQueries: 1, writeQueries: 1, rowsRead: 900, rowsWritten: 30, p90Ms: 1 }] } },
    r2: { ok: false, error: "x" },
  };
  it("แยกยอดวันนี้และขยายเป็นรายเดือน", () => {
    const s = summarizeUsage(usage, 2_000_000_000, now);
    expect(s.today.workerRequests).toBe(500);
    expect(s.today.d1RowsRead).toBe(900);
    expect(s.period.workerRequests).toBe(1500);
    expect(s.monthly.workerRequests).toBeCloseTo((1500 / 1.5) * 30);
    expect(s.monthly.workerCpuMs).toBeCloseTo(((1000 * 2 + 500 * 4) / 1.5) * 30);
    expect(s.monthly.d1StorageGb).toBe(2);
    expect(s.peakDailyPct.workerRequests).toBeCloseTo(1);
  });
  it("ไม่มี token = ไม่มีข้อมูล ไม่พัง", () => {
    const s = summarizeUsage(null, null, now);
    expect(s.today.workerRequests).toBeNull();
    expect(s.monthly.workerRequests).toBe(0);
  });
});
