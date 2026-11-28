import { describe, expect, it } from "vitest";

import { DEFAULT_THEME, isThemeId, resolveTheme } from "./theme";

describe("resolveTheme", () => {
  it("ใช้ธีมในบัญชีก่อน cookie", () => {
    expect(resolveTheme("cinema", "market")).toBe("cinema");
  });
  it("ไม่มีธีมในบัญชีก็ใช้ cookie", () => {
    expect(resolveTheme(null, "market")).toBe("market");
  });
  it("ค่าแปลก ๆ ใช้ค่าเริ่มต้น", () => {
    expect(resolveTheme("purple", "<script>")).toBe(DEFAULT_THEME);
    expect(resolveTheme(undefined, undefined)).toBe("paper");
  });
  it("isThemeId", () => {
    expect(isThemeId("paper")).toBe(true);
    expect(isThemeId("Paper")).toBe(false);
    expect(isThemeId(1)).toBe(false);
  });
});
