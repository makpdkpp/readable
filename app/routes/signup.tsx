import { eq } from "drizzle-orm";
import { Form, Link, redirect, useNavigation } from "react-router";

import type { Route } from "./+types/signup";
import { AuthCard, Field, FormError, OAuthButtons, SubmitButton } from "~/components/auth-ui";
import { getDb } from "~/db/client";
import { users } from "~/db/schema";
import { enabledProviders } from "~/lib/auth/oauth.server";
import { hashPassword } from "~/lib/auth/password";
import { assertSameOrigin, createSession, getCurrentUser } from "~/lib/auth/session.server";
import {
  PASSWORD_MIN,
  isValidEmail,
  normalizeEmail,
  safeRedirect,
  validateDisplayName,
  validatePassword,
} from "~/lib/auth/validation";

export function meta({}: Route.MetaArgs) {
  return [{ title: "สมัครสมาชิก — readable" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const redirectTo = safeRedirect(new URL(request.url).searchParams.get("redirectTo"));
  if (await getCurrentUser(request)) throw redirect(redirectTo);
  return { providers: enabledProviders(), redirectTo };
}

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));
  const displayName = String(form.get("displayName") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const redirectTo = safeRedirect(form.get("redirectTo"));
  const values = { email, displayName };

  if (!isValidEmail(email)) return { error: "รูปแบบอีเมลไม่ถูกต้อง", values };
  const nameError = validateDisplayName(displayName);
  if (nameError) return { error: nameError, values };
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError, values };

  const db = getDb();
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (taken) {
    return { error: "อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทน", values };
  }

  const id = crypto.randomUUID();
  await db.insert(users).values({
    id,
    email,
    displayName,
    passwordHash: await hashPassword(password),
  });

  const cookie = await createSession(request, id);
  throw redirect(redirectTo, { headers: { "Set-Cookie": cookie } });
}

export default function Signup({ loaderData, actionData }: Route.ComponentProps) {
  const { providers, redirectTo } = loaderData;
  const busy = useNavigation().state === "submitting";
  return (
    <AuthCard title="สมัครสมาชิก">
      <FormError message={actionData?.error} />
      <OAuthButtons providers={providers} redirectTo={redirectTo} />
      <Form method="post" className="space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <Field label="อีเมล" name="email" type="email" autoComplete="email" defaultValue={actionData?.values.email} />
        <Field
          label="นามปากกา / ชื่อที่แสดง"
          name="displayName"
          autoComplete="nickname"
          defaultValue={actionData?.values.displayName}
          hint="แก้ไขภายหลังได้"
        />
        <Field
          label="รหัสผ่าน"
          name="password"
          type="password"
          autoComplete="new-password"
          hint={`อย่างน้อย ${PASSWORD_MIN} ตัวอักษร`}
        />
        <p className="text-xs text-muted">
          การสมัครสมาชิกถือว่าคุณรับทราบ{" "}
          <a href="/privacy" target="_blank" className="underline">
            นโยบายความเป็นส่วนตัว
          </a>
        </p>
        <SubmitButton busy={busy}>สมัครสมาชิก</SubmitButton>
      </Form>
      <p className="text-center text-sm text-muted">
        มีบัญชีแล้ว?{" "}
        <Link to={`/login?redirectTo=${encodeURIComponent(redirectTo)}`} className="text-accent font-semibold">
          เข้าสู่ระบบ
        </Link>
      </p>
    </AuthCard>
  );
}
