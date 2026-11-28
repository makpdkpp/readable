import { describe, expect, it } from "vitest";

import { withSecurityHeaders } from "./security-headers";

describe("security headers", () => {
  it("ใส่ header กัน iframe และ HSTS เมื่อเป็น https", () => {
    const res = withSecurityHeaders(new Response("ok"), true);
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=");
  });
  it("ไม่ทับ header ที่หน้านั้นตั้งไว้เอง และไม่ใส่ HSTS บน http", () => {
    const res = withSecurityHeaders(
      new Response("ok", { status: 302, headers: { "Referrer-Policy": "no-referrer", Location: "/" } }),
      false,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(res.headers.get("Location")).toBe("/");
    expect(res.headers.has("Strict-Transport-Security")).toBe(false);
  });
});
