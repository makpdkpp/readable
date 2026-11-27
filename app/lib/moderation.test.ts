import { describe, expect, it } from "vitest";
import { ageOn, canRead, statusOnPublish } from "./moderation";

describe("statusOnPublish", () => {
  it("ส่งเรื่อง 18+ เข้าคิวอนุมัติ", () => {
    expect(statusOnPublish("18+")).toBe("pending_review");
  });
  it("เรื่องเรตอื่นเผยแพร่ได้ทันที", () => {
    expect(statusOnPublish("all")).toBe("ongoing");
    expect(statusOnPublish("13+")).toBe("ongoing");
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
