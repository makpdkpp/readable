import { describe, expect, it } from "vitest";

import { likePattern, normalizeQuery } from "./search";

describe("normalizeQuery", () => {
  it("ตัดช่องว่างและ # หน้าแท็ก", () => {
    expect(normalizeQuery("  #รักใส   วัยเรียน ")).toBe("รักใส วัยเรียน");
    expect(normalizeQuery(null)).toBe("");
  });
  it("ตัวพิมพ์เล็กเพื่อให้ตรงกับแท็กที่เก็บไว้", () => expect(normalizeQuery("BL")).toBe("bl"));
  it("จำกัดความยาว", () => expect(normalizeQuery("ก".repeat(500))).toHaveLength(100));
});

describe("likePattern", () => {
  it("ครอบด้วย % ให้ค้นกลางคำได้", () => expect(likePattern("เชียง")).toBe("%เชียง%"));
  it("escape อักขระพิเศษของ LIKE", () => expect(likePattern("100%_a\\b")).toBe("%100\\%\\_a\\\\b%"));
});
