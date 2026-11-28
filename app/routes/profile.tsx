import { eq } from "drizzle-orm";
import { Form, redirect, useNavigation } from "react-router";

import type { Route } from "./+types/profile";
import { Field, FormError, SubmitButton } from "~/components/auth-ui";
import { ThemePicker } from "~/components/theme-switcher";
import { getDb } from "~/db/client";
import { oauthAccounts, users } from "~/db/schema";
import { hashPassword, verifyPassword } from "~/lib/auth/password";
import { deleteAccount } from "~/lib/auth/delete-account.server";
import { assertSameOrigin, destroySession, requireUser } from "~/lib/auth/session.server";
import { isValidBirthDate, validateDisplayName, validatePassword } from "~/lib/auth/validation";
import { ageOn } from "~/lib/moderation";

export function meta({}: Route.MetaArgs) {
  return [{ title: "โปรไฟล์ — readable" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const db = getDb();
  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id));
  const linked = await db
    .select({ provider: oauthAccounts.provider })
    .from(oauthAccounts)
    .where(eq(oauthAccounts.userId, user.id));
  return {
    user,
    hasPassword: !!row?.passwordHash,
    linked: linked.map((l) => l.provider),
    placeholderEmail: user.email.endsWith("@users.noreply.readable"),
  };
}

type ActionResult = { form: "profile" | "password" | "delete"; error?: string; ok?: string };

const DELETE_CONFIRM = "ลบบัญชี";

export async function action({ request }: Route.ActionArgs): Promise<ActionResult> {
  assertSameOrigin(request);
  const user = await requireUser(request);
  const form = await request.formData();
  const db = getDb();

  if (form.get("intent") === "delete-account") {
    if (String(form.get("confirm") ?? "").trim() !== DELETE_CONFIRM) {
      return { form: "delete", error: `พิมพ์คำว่า “${DELETE_CONFIRM}” เพื่อยืนยัน` };
    }
    const cookie = await destroySession(request);
    await deleteAccount(user.id);
    throw redirect("/?deleted=1", { headers: { "Set-Cookie": cookie } });
  }

  if (form.get("intent") === "password") {
    if (user.email.endsWith("@users.noreply.readable")) {
      return { form: "password", error: "บัญชีนี้ยังไม่มีอีเมล จึงตั้งรหัสผ่านไม่ได้" };
    }
    const current = String(form.get("currentPassword") ?? "");
    const next = String(form.get("newPassword") ?? "");
    const [row] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, user.id));
    if (row?.passwordHash && !(await verifyPassword(current, row.passwordHash))) {
      return { form: "password", error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
    }
    const err = validatePassword(next);
    if (err) return { form: "password", error: err };
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(next), updatedAt: new Date() })
      .where(eq(users.id, user.id));
    return { form: "password", ok: "บันทึกรหัสผ่านแล้ว" };
  }

  const displayName = String(form.get("displayName") ?? "").trim();
  const nameError = validateDisplayName(displayName);
  if (nameError) return { form: "profile", error: nameError };

  const update: { displayName: string; birthDate?: string; updatedAt: Date } = {
    displayName,
    updatedAt: new Date(),
  };
  // วันเกิดตั้งได้ครั้งเดียว กันการแก้อายุเพื่อเปิดอ่านเรื่อง 18+
  const birthDate = String(form.get("birthDate") ?? "").trim();
  if (!user.birthDate && birthDate) {
    if (!isValidBirthDate(birthDate)) return { form: "profile", error: "วันเกิดไม่ถูกต้อง" };
    update.birthDate = birthDate;
  }
  await db.update(users).set(update).where(eq(users.id, user.id));
  return { form: "profile", ok: "บันทึกแล้ว" };
}

const PROVIDER_NAME = { google: "Google", line: "LINE" } as const;

export default function Profile({ loaderData, actionData }: Route.ComponentProps) {
  const { user, hasPassword, linked, placeholderEmail } = loaderData;
  const busy = useNavigation().state === "submitting";
  const msg = (f: ActionResult["form"]) =>
    actionData?.form === f ? actionData : undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-8">
      <h1 className="text-2xl font-bold">โปรไฟล์</h1>

      <section className="card p-6 space-y-3">
        <h2 className="font-semibold">ธีมของเว็บ</h2>
        <p className="text-sm text-muted">เลือกหน้าตาที่ชอบ ระบบจะจำไว้ในบัญชีนี้ทุกเครื่องที่ล็อกอิน</p>
        <ThemePicker />
      </section>

      <section className="card p-6 space-y-4">
        <div className="text-sm">
          <div className="font-semibold">อีเมล</div>
          <div className="text-muted">
            {placeholderEmail ? "ยังไม่มีอีเมล (ล็อกอินผ่าน LINE)" : user.email}
          </div>
          {linked.length > 0 && (
            <div className="mt-1 text-muted">
              เชื่อมกับ {linked.map((p) => PROVIDER_NAME[p]).join(", ")}
            </div>
          )}
        </div>
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="profile" />
          <FormError message={msg("profile")?.error} />
          {msg("profile")?.ok && <p className="text-sm text-ok">{msg("profile")?.ok}</p>}
          <Field label="นามปากกา / ชื่อที่แสดง" name="displayName" defaultValue={user.displayName} />
          {user.birthDate ? (
            <div className="text-sm">
              <div className="font-semibold">วันเกิด</div>
              <div className="text-muted">
                {user.birthDate} (อายุ {ageOn(user.birthDate, new Date())} ปี)
              </div>
            </div>
          ) : (
            <Field
              label="วันเกิด"
              name="birthDate"
              type="date"
              required={false}
              hint="ใช้ยืนยันอายุสำหรับเรื่อง 18+ ตั้งได้ครั้งเดียว"
            />
          )}
          <SubmitButton busy={busy}>บันทึก</SubmitButton>
        </Form>
      </section>

      {!placeholderEmail && (
      <section className="card p-6 space-y-4">
        <h2 className="font-semibold">{hasPassword ? "เปลี่ยนรหัสผ่าน" : "ตั้งรหัสผ่าน"}</h2>
        {!hasPassword && (
          <p className="text-sm text-muted">ตั้งรหัสผ่านไว้เพื่อล็อกอินด้วยอีเมลได้ด้วย</p>
        )}
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="password" />
          <FormError message={msg("password")?.error} />
          {msg("password")?.ok && <p className="text-sm text-ok">{msg("password")?.ok}</p>}
          {hasPassword && (
            <Field label="รหัสผ่านปัจจุบัน" name="currentPassword" type="password" autoComplete="current-password" />
          )}
          <Field label="รหัสผ่านใหม่" name="newPassword" type="password" autoComplete="new-password" />
          <SubmitButton busy={busy}>บันทึกรหัสผ่าน</SubmitButton>
        </Form>
      </section>
      )}

      <section className="card p-6 space-y-3">
        <h2 className="font-semibold text-danger">ลบบัญชี</h2>
        <p className="text-sm text-muted">
          ลบบัญชีและข้อมูลทั้งหมดของคุณถาวร รวมถึงนิยายที่เขียน ชั้นหนังสือ ประวัติการอ่าน คอมเมนต์ และยอดถูกใจ
          กู้คืนไม่ได้ อ่านรายละเอียดใน <a href="/privacy" className="underline">นโยบายความเป็นส่วนตัว</a>
        </p>
        <details open={!!msg("delete")}>
          <summary className="cursor-pointer text-sm text-danger">ฉันต้องการลบบัญชี</summary>
          <Form method="post" className="mt-3 space-y-3">
            <input type="hidden" name="intent" value="delete-account" />
            <FormError message={msg("delete")?.error} />
            <Field
              label={`พิมพ์ “${DELETE_CONFIRM}” เพื่อยืนยัน`}
              name="confirm"
              autoComplete="off"
            />
            <button type="submit" disabled={busy} className="btn btn-danger">
              ลบบัญชีถาวร
            </button>
          </Form>
        </details>
      </section>
    </div>
  );
}
