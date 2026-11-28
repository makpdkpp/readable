import { describe, expect, it } from "vitest";
import { ageOn, canRead, isChapterLive, statusOnPublish, statusOnRatingChange } from "./moderation";

describe("statusOnPublish", () => {
  it("ส่งเรื่อง 18+ เข้าคิวอนุมัติ", () => {
    expect(statusOnPublish("18+")).toBe("pending_review");
  });
  it("เรื่องเรตอื่นเผยแพร่ได้ทันที", () => {
    expect(statusOnPublish("all")).toBe("ongoing");
    expect(statusOnPublish("13+")).toBe("ongoing");
  });
  it("เรื่องที่ไม่ผ่านการอนุมัติ ลดเรตแล้วก็ต้องให้ admin ตรวจอีกครั้ง", () => {
    expect(statusOnPublish("all", "rejected")).toBe("pending_review");
    expect(statusOnPublish("18+", "rejected")).toBe("pending_review");
    expect(statusOnPublish("all", "draft")).toBe("ongoing");
  });
});

describe("canRead", () => {
  const today = new Date(Date.UTC(2026, 10, 27));
  it("ทุกคนอ่านเรื่องทั่วไปได้", () => {
    expect(canRead("all", null, today)).toBe(true);
  });
  it("คนไม่ล็อกอินอ่าน 18+ ไม่ได้", () => {
    expect(canRead("18+", null, today)).toBe(false);
  });
  it("นับอายุครบ 18 ในวันเกิดพอดี", () => {
    expect(ageOn("2008-11-27", today)).toBe(18);
    expect(canRead("18+", { birthDate: "2008-11-27" }, today)).toBe(true);
    expect(canRead("18+", { birthDate: "2008-11-28" }, today)).toBe(false);
  });
});

describe("statusOnRatingChange", () => {
  it("เรื่องที่ขึ้นเว็บแล้วเปลี่ยนเป็น 18+ ต้องรออนุมัติใหม่", () => {
    expect(statusOnRatingChange("ongoing", "all", "18+")).toBe("pending_review");
    expect(statusOnRatingChange("completed", "13+", "18+")).toBe("pending_review");
  });
  it("เรื่องร่างเปลี่ยนเรตได้เลย รอส่งตอนเผยแพร่", () => {
    expect(statusOnRatingChange("draft", "all", "18+")).toBe("draft");
  });
  it("เรื่อง 18+ ที่อนุมัติแล้ว แก้อย่างอื่นไม่ต้องรอใหม่", () => {
    expect(statusOnRatingChange("ongoing", "18+", "18+")).toBe("ongoing");
  });
  it("รออนุมัติอยู่แล้วลดเรต ขึ้นเว็บได้เลย", () => {
    expect(statusOnRatingChange("pending_review", "18+", "13+")).toBe("ongoing");
  });
  it("เรื่องที่ admin ซ่อนยังซ่อนอยู่", () => {
    expect(statusOnRatingChange("hidden", "all", "18+")).toBe("hidden");
  });
});

describe("isChapterLive", () => {
  const now = new Date("2026-11-28T12:00:00Z");
  it("ตอนตั้งเวลาขึ้นเมื่อถึงเวลา", () => {
    expect(isChapterLive({ status: "scheduled", publishAt: new Date("2026-11-28T11:59:00Z") }, now)).toBe(true);
    expect(isChapterLive({ status: "scheduled", publishAt: new Date("2026-11-28T12:01:00Z") }, now)).toBe(false);
  });
  it("ร่างไม่ขึ้น", () => {
    expect(isChapterLive({ status: "draft", publishAt: null }, now)).toBe(false);
    expect(isChapterLive({ status: "published", publishAt: null }, now)).toBe(true);
  });
});
