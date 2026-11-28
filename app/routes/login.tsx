import { eq } from "drizzle-orm";
import { Form, Link, redirect, useNavigation } from "react-router";

import type { Route } from "./+types/login";
import { AuthCard, Field, FormError, OAuthButtons, SubmitButton } from "~/components/auth-ui";
import { getDb } from "~/db/client";
import { users } from "~/db/schema";
import { enabledProviders } from "~/lib/auth/oauth.server";
import { verifyPassword } from "~/lib/auth/password";
import { assertSameOrigin, createSession, getCurrentUser } from "~/lib/auth/session.server";
import { normalizeEmail, safeRedirect } from "~/lib/auth/validation";
import { RATE_LIMIT_MESSAGE, anyRateLimited, clientIp } from "~/lib/rate-limit.server";

// แฮชหลอกไว้เทียบเมื่อไม่พบอีเมล ให้ใช้เวลาตอบพอๆ กัน คนนอกจะเดาไม่ได้ว่าอีเมลไหนมีบัญชี
const DUMMY_HASH =
  "pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

const OAUTH_ERRORS: Record<string, string> = {
  oauth: "ล็อกอินไม่สำเร็จ ลองใหม่อีกครั้ง",
  provider: "ช่องทางล็อกอินนี้ยังไม่เปิดใช้",
};

export function meta({}: Route.MetaArgs) {
  return [{ title: "เข้าสู่ระบบ — readable" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const redirectTo = safeRedirect(url.searchParams.get("redirectTo"));
  if (await getCurrentUser(request)) throw redirect(redirectTo);
  const error = OAUTH_ERRORS[url.searchParams.get("error") ?? ""] ?? null;
  return { providers: enabledProviders(), redirectTo, error };
}

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));
  const password = String(form.get("password") ?? "");
  const redirectTo = safeRedirect(form.get("redirectTo"));
  // กันเดารหัสผ่าน: นับทั้งต่อ IP และต่ออีเมล (เผื่อยิงจากหลาย IP ใส่บัญชีเดียว)
  if (await anyRateLimited("auth", [`login-ip:${clientIp(request)}`, `login-email:${email}`])) {
    return { error: RATE_LIMIT_MESSAGE, email };
  }

  const [user] = await getDb()
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.passwordHash || !ok) {
    return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง", email };
  }

  const cookie = await createSession(request, user.id);
  throw redirect(redirectTo, { headers: { "Set-Cookie": cookie } });
}

export default function Login({ loaderData, actionData }: Route.ComponentProps) {
  const { providers, redirectTo, error } = loaderData;
  const busy = useNavigation().state === "submitting";
  return (
    <AuthCard title="เข้าสู่ระบบ">
      <FormError message={actionData?.error ?? error} />
      <OAuthButtons providers={providers} redirectTo={redirectTo} />
      <Form method="post" className="space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <Field label="อีเมล" name="email" type="email" autoComplete="email" defaultValue={actionData?.email} />
        <Field label="รหัสผ่าน" name="password" type="password" autoComplete="current-password" />
        <SubmitButton busy={busy}>เข้าสู่ระบบ</SubmitButton>
      </Form>
      <p className="text-center text-sm text-muted">
        ยังไม่มีบัญชี?{" "}
        <Link to={`/signup?redirectTo=${encodeURIComponent(redirectTo)}`} className="text-accent font-semibold">
          สมัครสมาชิก
        </Link>
      </p>
    </AuthCard>
  );
}
