import { data, redirect } from "react-router";
import { eq } from "drizzle-orm";

import type { Route } from "./+types/theme";
import { getDb } from "~/db/client";
import { users } from "~/db/schema";
import { isSecureRequest, serializeCookie } from "~/lib/auth/cookies";
import { assertSameOrigin, getCurrentUser } from "~/lib/auth/session.server";
import { safeRedirect } from "~/lib/auth/validation";
import { THEME_COOKIE, isThemeId } from "~/lib/theme";

const ONE_YEAR = 365 * 24 * 60 * 60;

/** เปลี่ยนธีมของเว็บ: จำไว้ใน cookie เสมอ และบันทึกลงบัญชีถ้าล็อกอินอยู่ */
export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const form = await request.formData();
  const theme = form.get("theme");
  if (!isThemeId(theme)) throw data({ error: "ไม่มีธีมนี้" }, { status: 400 });

  const user = await getCurrentUser(request);
  if (user) {
    await getDb().update(users).set({ theme, updatedAt: new Date() }).where(eq(users.id, user.id));
  }
  const headers = {
    "Set-Cookie": serializeCookie(THEME_COOKIE, theme, { maxAge: ONE_YEAR, secure: isSecureRequest(request) }),
  };
  // ปุ่มเปลี่ยนธีมที่ใช้ JavaScript ส่ง js=1 มา จะได้ไม่ต้องเปลี่ยนหน้า
  if (form.get("js") === "1") return data({ theme }, { headers });
  throw redirect(safeRedirect(form.get("redirectTo")), { headers });
}

export function loader() {
  throw redirect("/");
}
