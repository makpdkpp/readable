import { describe, expect, it } from "vitest";

import { COMMENT_MAX, commentCooldownLeft, parseCommentBody } from "./community";

describe("parseCommentBody", () => {
  it("ตัดช่องว่างและยุบบรรทัดว่าง", () => {
    expect(parseCommentBody("  สนุกมาก\r\n\r\n\r\n\r\nรอตอนต่อไป  ")).toEqual({ body: "สนุกมาก\n\nรอตอนต่อไป" });
  });
  it("ไม่รับคอมเมนต์ว่าง", () => {
    expect(parseCommentBody("   \n ")).toHaveProperty("error");
    expect(parseCommentBody(null)).toHaveProperty("error");
  });
  it("นับความยาวเป็นตัวอักษร ไม่ใช่ byte", () => {
    expect(parseCommentBody("ก".repeat(COMMENT_MAX))).toEqual({ body: "ก".repeat(COMMENT_MAX) });
    expect(parseCommentBody("ก".repeat(COMMENT_MAX + 1))).toHaveProperty("error");
  });
});

describe("commentCooldownLeft", () => {
  const now = new Date("2026-11-28T10:00:00Z");
  it("ไม่เคยคอมเมนต์ ส่งได้เลย", () => expect(commentCooldownLeft(null, now)).toBe(0));
  it("เพิ่งส่งไป 3 วินาที ต้องรออีก 7", () =>
    expect(commentCooldownLeft(new Date(now.getTime() - 3000), now)).toBe(7));
  it("ผ่านไปนานแล้ว", () => expect(commentCooldownLeft(new Date(now.getTime() - 60000), now)).toBe(0));
});
