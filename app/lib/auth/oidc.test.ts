import { describe, expect, it } from "vitest";

import { authorizationUrl, codeChallenge, decodeJwtPayload, exchangeCode, validateClaims } from "./oidc";

const client = { id: "cid", secret: "sec", redirectUri: "https://r.example/auth/google/callback" };

function jwt(payload: object) {
  const b = (o: object) => {
    let s = "";
    for (const x of new TextEncoder().encode(JSON.stringify(o))) s += String.fromCharCode(x);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  return `${b({ alg: "RS256" })}.${b(payload)}.sig`;
}

describe("oidc", () => {
  it("PKCE S256 = base64url(sha256(verifier)) ไม่มี padding", async () => {
    // sha256("abc") = ba7816bf...15ad
    expect(await codeChallenge("abc")).toBe("ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0");
  });

  it("URL ล็อกอินมี state, nonce และ code_challenge", async () => {
    const url = await authorizationUrl("line", client, { state: "s1", nonce: "n1", verifier: "v1" });
    expect(url.origin).toBe("https://access.line.me");
    expect(url.searchParams.get("state")).toBe("s1");
    expect(url.searchParams.get("nonce")).toBe("n1");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(await codeChallenge("v1"));
    expect(url.searchParams.get("redirect_uri")).toBe(client.redirectUri);
  });

  it("แลก code ส่ง verifier ไปด้วย และคืน id token", async () => {
    let sent: URLSearchParams | null = null;
    const fake = (async (_url: string, init: RequestInit) => {
      sent = init.body as URLSearchParams;
      return new Response(JSON.stringify({ id_token: "a.b.c" }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await exchangeCode("google", client, "code1", "ver1", fake)).toBe("a.b.c");
    expect(sent!.get("code_verifier")).toBe("ver1");
    const failing = (async () => new Response("no", { status: 400 })) as unknown as typeof fetch;
    await expect(exchangeCode("google", client, "c", "v", failing)).rejects.toThrow();
  });

  it("อ่าน payload ของ JWT (รวมภาษาไทย)", () => {
    expect(decodeJwtPayload(jwt({ sub: "1", name: "มากิ" }))).toEqual({ sub: "1", name: "มากิ" });
    expect(decodeJwtPayload("ไม่ใช่ jwt")).toBeNull();
  });

  describe("ตรวจ id token", () => {
    const now = Date.UTC(2026, 10, 28);
    const good = { iss: "https://accounts.google.com", aud: "cid", exp: now / 1000 + 300, nonce: "n", sub: "u1" };
    const ok = (c: object) => validateClaims("google", c, { clientId: "cid", nonce: "n" }, now);

    it("ผ่านเมื่อทุกอย่างถูก", () => expect(ok(good)).toBe(true));
    it("ผู้ออกไม่ใช่ Google", () => expect(ok({ ...good, iss: "https://evil.example" })).toBe(false));
    it("ออกให้แอปอื่น", () => expect(ok({ ...good, aud: "other" })).toBe(false));
    it("หมดอายุแล้ว", () => expect(ok({ ...good, exp: now / 1000 - 3600 })).toBe(false));
    it("nonce ไม่ตรง (เอา token เก่ามาใช้ซ้ำ)", () => expect(ok({ ...good, nonce: "x" })).toBe(false));
    it("ไม่มี sub", () => expect(ok({ ...good, sub: undefined })).toBe(false));
    it("LINE ต้องเป็น access.line.me", () => {
      const line = { ...good, iss: "https://access.line.me" };
      expect(validateClaims("line", line, { clientId: "cid", nonce: "n" }, now)).toBe(true);
      expect(validateClaims("line", good, { clientId: "cid", nonce: "n" }, now)).toBe(false);
    });
  });
});
