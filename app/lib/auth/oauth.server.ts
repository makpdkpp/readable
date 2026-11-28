import { env } from "cloudflare:workers";
import { Google, Line, decodeIdToken, generateCodeVerifier, generateState } from "arctic";
import { and, eq } from "drizzle-orm";

import { getDb } from "~/db/client";
import { oauthAccounts, sessions, users, type OAuthProvider } from "~/db/schema";
import { isSecureRequest, parseCookies, serializeCookie } from "./cookies";
import { normalizeEmail } from "./validation";

export const OAUTH_PROVIDERS: OAuthProvider[] = ["google", "line"];
const STATE_COOKIE = "rb_oauth";

export function isProvider(value: unknown): value is OAuthProvider {
  return OAUTH_PROVIDERS.includes(value as OAuthProvider);
}

/** ผู้ให้บริการที่ตั้งค่า client id/secret แล้ว ปุ่มที่ยังไม่ตั้งค่าจะไม่แสดง */
export function enabledProviders(): OAuthProvider[] {
  return OAUTH_PROVIDERS.filter((p) => credentials(p) !== null);
}

function credentials(provider: OAuthProvider) {
  const [id, secret] =
    provider === "google"
      ? [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET]
      : [env.LINE_CHANNEL_ID, env.LINE_CHANNEL_SECRET];
  return id && secret ? { id, secret } : null;
}

function client(provider: OAuthProvider, request: Request) {
  const creds = credentials(provider);
  if (!creds) return null;
  const callback = `${new URL(request.url).origin}/auth/${provider}/callback`;
  return provider === "google"
    ? new Google(creds.id, creds.secret, callback)
    : new Line(creds.id, creds.secret, callback);
}

/** สร้าง URL ไปหน้าล็อกอินของ Google/LINE พร้อม cookie เก็บ state ไว้ตรวจตอนกลับมา */
export function startOAuth(provider: OAuthProvider, request: Request, redirectTo: string) {
  const c = client(provider, request);
  if (!c) return null;
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = c.createAuthorizationURL(state, verifier, ["openid", "profile", "email"]);
  const cookie = serializeCookie(
    STATE_COOKIE,
    JSON.stringify({ provider, state, verifier, redirectTo }),
    { maxAge: 600, secure: isSecureRequest(request), path: "/auth" },
  );
  return { url: url.toString(), cookie };
}

export function clearStateCookie(request: Request) {
  return serializeCookie(STATE_COOKIE, "", {
    maxAge: 0,
    secure: isSecureRequest(request),
    path: "/auth",
  });
}

export type OAuthProfile = {
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
};

type IdTokenClaims = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

/**
 * ตรวจ state แล้วแลก code เป็นข้อมูลผู้ใช้
 * id token ได้มาจาก Google/LINE โดยตรงผ่าน HTTPS จึงอ่านได้โดยไม่ต้องตรวจลายเซ็นซ้ำ
 */
export async function finishOAuth(
  provider: OAuthProvider,
  request: Request,
): Promise<{ profile: OAuthProfile; redirectTo: string } | null> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const raw = parseCookies(request.headers.get("Cookie"))[STATE_COOKIE];
  if (!code || !state || !raw) return null;

  let saved: { provider: string; state: string; verifier: string; redirectTo: string };
  try {
    saved = JSON.parse(raw);
  } catch {
    return null;
  }
  if (saved.provider !== provider || saved.state !== state) return null;

  const c = client(provider, request);
  if (!c) return null;
  const tokens = await c.validateAuthorizationCode(code, saved.verifier);
  const claims = decodeIdToken(tokens.idToken()) as IdTokenClaims;
  if (!claims.sub) return null;

  const email = claims.email ? normalizeEmail(claims.email) : null;
  return {
    profile: {
      providerUserId: claims.sub,
      email,
      // LINE ให้อีเมลเฉพาะที่ผู้ใช้ยืนยันกับ LINE แล้ว ส่วน Google บอกมาใน email_verified
      emailVerified: !!email && (provider === "line" || claims.email_verified === true),
      name: claims.name?.trim() || null,
    },
    redirectTo: saved.redirectTo,
  };
}

/**
 * หาผู้ใช้จากบัญชี Google/LINE ถ้ายังไม่เคยผูกจะผูกกับบัญชีที่ใช้อีเมลเดียวกัน หรือสร้างบัญชีใหม่
 * คืนค่า id ของผู้ใช้
 */
export async function findOrCreateOAuthUser(
  provider: OAuthProvider,
  profile: OAuthProfile,
): Promise<string> {
  const db = getDb();
  const [linked] = await db
    .select({ userId: oauthAccounts.userId })
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.provider, provider),
        eq(oauthAccounts.providerUserId, profile.providerUserId),
      ),
    )
    .limit(1);
  if (linked) return linked.userId;

  // ผูกกับบัญชีเดิมเฉพาะเมื่อผู้ให้บริการยืนยันอีเมลแล้ว
  if (profile.email && profile.emailVerified) {
    const [existing] = await db
      .select({ id: users.id, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.email, profile.email))
      .limit(1);
    if (existing) {
      if (!existing.emailVerified) {
        // บัญชีนี้สมัครด้วยอีเมลที่ยังไม่ได้ยืนยัน อาจมีคนอื่นสมัครดักไว้
        // เจ้าของอีเมลตัวจริงพิสูจน์ตัวแล้ว จึงยกเลิกรหัสผ่านเดิมและ session ทั้งหมดของบัญชีนี้
        await db
          .update(users)
          .set({ emailVerified: true, passwordHash: null, updatedAt: new Date() })
          .where(eq(users.id, existing.id));
        await db.delete(sessions).where(eq(sessions.userId, existing.id));
      }
      await db.insert(oauthAccounts).values({
        provider,
        providerUserId: profile.providerUserId,
        userId: existing.id,
      });
      return existing.id;
    }
  }

  const id = crypto.randomUUID();
  // บัญชี LINE ที่ไม่ได้ให้อีเมล ใช้อีเมลชั่วคราวที่ส่งจริงไม่ได้ไปก่อน แก้ได้ภายหลัง
  const email =
    profile.email && profile.emailVerified
      ? profile.email
      : `${provider}-${profile.providerUserId}@users.noreply.readable`;
  await db.batch([
    db.insert(users).values({
      id,
      email,
      displayName: (profile.name ?? "นักอ่าน").slice(0, 50),
      emailVerified: !!(profile.email && profile.emailVerified),
    }),
    db.insert(oauthAccounts).values({
      provider,
      providerUserId: profile.providerUserId,
      userId: id,
    }),
  ]);
  return id;
}
