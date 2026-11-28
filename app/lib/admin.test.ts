import { describe, expect, it } from "vitest";

import { isRole, parseAdminEmails, roleChangeError } from "./admin";

describe("parseAdminEmails", () => {
  it("แยกด้วยจุลภาคหรือช่องว่าง และเป็นตัวพิมพ์เล็ก", () => {
    expect([...parseAdminEmails(" A@x.com, b@y.com\nc@z.com ,, nope")]).toEqual(["a@x.com", "b@y.com", "c@z.com"]);
  });
  it("ไม่ตั้งค่า = ว่าง", () => expect(parseAdminEmails(undefined).size).toBe(0));
});

describe("roleChangeError", () => {
  const admins = parseAdminEmails("boss@x.com");
  const me = { id: "me", email: "me@x.com" };
  it("ลดสิทธิ์ตัวเองไม่ได้", () => expect(roleChangeError(me, me, "reader", admins)).not.toBeNull());
  it("ตั้งตัวเองเป็น admin ซ้ำได้", () => expect(roleChangeError(me, me, "admin", admins)).toBeNull());
  it("ลดสิทธิ์คนใน ADMIN_EMAILS ไม่ได้", () =>
    expect(roleChangeError(me, { id: "b", email: "Boss@x.com" }, "writer", admins)).not.toBeNull());
  it("ตั้งคนอื่นเป็น admin ได้", () =>
    expect(roleChangeError(me, { id: "u", email: "u@x.com" }, "admin", admins)).toBeNull());
});

describe("isRole", () => {
  it("รับเฉพาะสิทธิ์ที่มี", () => {
    expect(isRole("writer")).toBe(true);
    expect(isRole("root")).toBe(false);
  });
});
