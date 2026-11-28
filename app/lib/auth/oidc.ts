/**
 * OAuth 2.0 + OpenID Connect สำหรับ Google และ LINE เขียนเองแทนแพ็กเกจ arctic
 * (arctic และ @oslojs ถูกประกาศว่าเลิกดูแลแล้วบน npm จึงไม่ควรอยู่ในเส้นทางล็อกอิน)
 * - ใช้ PKCE (S256) + state กันการสวมรอยตอนกลับมาจากผู้ให้บริการ
 * - ใส่ nonce ใน id token แล้วตรวจคืน กันเอา id token เก่ามาใช้ซ้ำ
 * - id token ได้จาก token endpoint ผ่าน HTTPS โดยตรง ตามมาตรฐาน OIDC จึงไม่ต้องตรวจลายเซ็น
 *   แต่ยังตรวจ iss, aud, exp และ nonce ทุกครั้ง
 */
import type { OAuthProvider } from "~/db/schema";

export type ProviderConfig = {
  authorizeUrl: string;
  tokenUrl: string;
  issuers: string[];
};

export const PROVIDERS: Record<OAuthProvider, ProviderConfig> = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    issuers: ["https://accounts.google.com", "accounts.google.com"],
  },
  line: {
    authorizeUrl: "https://access.line.me/oauth2/v2.1/authorize",
    tokenUrl: "https://api.line.me/oauth2/v2.1/token",
    issuers: ["https://access.line.me"],
  },
};

export type Client = { id: string; secret: string; redirectUri: string };

export type IdTokenClaims = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nonce?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** ค่าสุ่ม 32 ไบต์ ใช้เป็น state, nonce และ code verifier */
export function randomToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export async function authorizationUrl(
  provider: OAuthProvider,
  client: Client,
  p: { state: string; nonce: string; verifier: string },
): Promise<URL> {
  const url = new URL(PROVIDERS[provider].authorizeUrl);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: client.id,
    redirect_uri: client.redirectUri,
    scope: "openid profile email",
    state: p.state,
    nonce: p.nonce,
    code_challenge: await codeChallenge(p.verifier),
    code_challenge_method: "S256",
  }).toString();
  return url;
}

/** แลก code เป็น id token (ส่งคำขอตรงไปที่ Google/LINE ผ่าน HTTPS) */
export async function exchangeCode(
  provider: OAuthProvider,
  client: Client,
  code: string,
  verifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(PROVIDERS[provider].tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: client.redirectUri,
      client_id: client.id,
      client_secret: client.secret,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`${provider} token endpoint ${res.status}`);
  const body = (await res.json()) as { id_token?: unknown };
  if (typeof body.id_token !== "string") throw new Error(`${provider} ไม่ส่ง id_token มา`);
  return body.id_token;
}

export function decodeJwtPayload(jwt: string): IdTokenClaims | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes));
    return claims && typeof claims === "object" ? (claims as IdTokenClaims) : null;
  } catch {
    return null;
  }
}

/** ตรวจว่า id token ออกโดยผู้ให้บริการนี้ ให้แอปเรา ยังไม่หมดอายุ และเป็นของคำขอนี้ (nonce) */
export function validateClaims(
  provider: OAuthProvider,
  claims: IdTokenClaims | null,
  expected: { clientId: string; nonce: string },
  now = Date.now(),
): claims is IdTokenClaims & { sub: string } {
  if (!claims || typeof claims.sub !== "string" || !claims.sub) return false;
  if (!claims.iss || !PROVIDERS[provider].issuers.includes(claims.iss)) return false;
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(expected.clientId)) return false;
  // เผื่อเวลานาฬิกาคลาดกัน 60 วินาที
  if (typeof claims.exp !== "number" || claims.exp * 1000 < now - 60_000) return false;
  if (claims.nonce !== expected.nonce) return false;
  return true;
}
