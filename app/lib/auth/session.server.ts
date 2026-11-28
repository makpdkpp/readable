import { and, eq, gt, lt } from "drizzle-orm";
import { redirect } from "react-router";

import { getDb } from "~/db/client";
import { sessions, users } from "~/db/schema";
import { isSecureRequest, parseCookies, serializeCookie } from "./cookies";
import { generateToken, sha256Hex } from "./token";

export const SESSION_COOKIE = "rb_session";
const SESSION_DAYS = 30;

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  role: "reader" | "writer" | "admin";
  birthDate: string | null;
};

/** สร้าง session ใหม่ให้ผู้ใช้ คืนค่า Set-Cookie สำหรับใส่ใน response */
export async function createSession(request: Request, userId: string): Promise<string> {
  const db = getDb();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ id: await sha256Hex(token), userId, expiresAt });
  // ล้าง session ที่หมดอายุของผู้ใช้คนนี้ไปด้วย ตารางจะได้ไม่โตเรื่อยๆ
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));
  return serializeCookie(SESSION_COOKIE, token, {
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    secure: isSecureRequest(request),
  });
}

export async function getCurrentUser(request: Request): Promise<CurrentUser | null> {
  const token = parseCookies(request.headers.get("Cookie"))[SESSION_COOKIE];
  if (!token) return null;
  const db = getDb();
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      birthDate: users.birthDate,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, await sha256Hex(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

/** ใช้ใน loader/action ของหน้าที่ต้องล็อกอิน ถ้ายังไม่ล็อกอินจะพาไปหน้าเข้าสู่ระบบ */
export async function requireUser(request: Request): Promise<CurrentUser> {
  const user = await getCurrentUser(request);
  if (!user) {
    const url = new URL(request.url);
    const redirectTo = url.pathname + url.search;
    throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }
  return user;
}

/** ลบ session ปัจจุบัน คืนค่า Set-Cookie ที่ล้าง cookie */
export async function destroySession(request: Request): Promise<string> {
  const token = parseCookies(request.headers.get("Cookie"))[SESSION_COOKIE];
  if (token) {
    await getDb()
      .delete(sessions)
      .where(eq(sessions.id, await sha256Hex(token)));
  }
  return serializeCookie(SESSION_COOKIE, "", { maxAge: 0, secure: isSecureRequest(request) });
}

/**
 * กัน CSRF เพิ่มจาก SameSite=Lax: ฟอร์มที่เปลี่ยนข้อมูลต้องส่งมาจากเว็บเราเอง
 * เบราว์เซอร์ปัจจุบันส่ง Origin มากับ POST เสมอ ถ้าไม่มีเลย (เช่นเครื่องมือทดสอบ) จะยอมให้ผ่าน
 */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new Response("Forbidden", { status: 403 });
  }
}
