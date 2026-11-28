import { describe, expect, it } from "vitest";

import { parseCookies, serializeCookie } from "./cookies";
import { hashPassword, verifyPassword } from "./password";
import { generateToken, sha256Hex } from "./token";
import { isValidBirthDate, isValidEmail, normalizeEmail, safeRedirect, validatePassword } from "./validation";

describe("password", () => {
  it("ยืนยันรหัสที่ถูกต้อง และปฏิเสธรหัสที่ผิด", async () => {
    const hash = await hashPassword("รหัสลับ1234");
    expect(hash.startsWith("pbkdf2$100000$")).toBe(true);
    expect(await verifyPassword("รหัสลับ1234", hash)).toBe(true);
    expect(await verifyPassword("รหัสลับ12345", hash)).toBe(false);
  });

  it("แฮชรหัสเดียวกันได้ไม่ซ้ำกัน (มี salt)", async () => {
    expect(await hashPassword("password1")).not.toBe(await hashPassword("password1"));
  });

  it("ค่าที่เก็บไว้ผิดรูปแบบ ถือว่าไม่ผ่าน", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$1$a$b")).toBe(false);
    expect(await verifyPassword("x", "pbkdf2$999999999$AAAA$AAAA")).toBe(false);
  });
});

describe("cookies", () => {
  it("อ่าน cookie หลายตัว", () => {
    expect(parseCookies("a=1; rb_session=abc%3D; b=2")).toEqual({ a: "1", rb_session: "abc=", b: "2" });
    expect(parseCookies(null)).toEqual({});
  });

  it("ตั้ง cookie แบบ HttpOnly และ Secure เมื่อเป็น https", () => {
    const c = serializeCookie("rb_session", "t", { maxAge: 60, secure: true });
    expect(c).toBe("rb_session=t; Path=/; Max-Age=60; HttpOnly; SameSite=Lax; Secure");
    expect(serializeCookie("x", "", { maxAge: 0, secure: false })).not.toContain("Secure");
  });
});

describe("token", () => {
  it("สุ่มไม่ซ้ำและใช้ใน URL/cookie ได้", () => {
    const t = generateToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(t);
  });

  it("sha256 ถูกต้อง", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("validation", () => {
  it("อีเมล", () => {
    expect(normalizeEmail("  Maki@Example.COM ")).toBe("maki@example.com");
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
  });

  it("รหัสผ่านสั้นเกินไป", () => {
    expect(validatePassword("1234567")).not.toBeNull();
    expect(validatePassword("12345678")).toBeNull();
  });

  it("วันเกิด", () => {
    const today = new Date("2026-11-28T00:00:00Z");
    expect(isValidBirthDate("2000-02-29", today)).toBe(true);
    expect(isValidBirthDate("2001-02-29", today)).toBe(false);
    expect(isValidBirthDate("2030-01-01", today)).toBe(false);
    expect(isValidBirthDate("01/02/2000", today)).toBe(false);
  });

  it("redirect ได้เฉพาะในเว็บเรา", () => {
    expect(safeRedirect("/profile?x=1")).toBe("/profile?x=1");
    expect(safeRedirect("https://evil.com")).toBe("/");
    expect(safeRedirect("//evil.com")).toBe("/");
    expect(safeRedirect("/\\evil.com")).toBe("/");
    expect(safeRedirect(null)).toBe("/");
  });
});
