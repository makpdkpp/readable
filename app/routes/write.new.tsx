import { eq } from "drizzle-orm";
import { redirect } from "react-router";

import type { Route } from "./+types/write.new";
import { NovelForm } from "~/components/novel-form";
import { getDb } from "~/db/client";
import { novels, users } from "~/db/schema";
import { assertSameOrigin, requireUser } from "~/lib/auth/session.server";
import { listCategories, setNovelTags } from "~/lib/novel/access.server";
import { uploadCover } from "~/lib/novel/cover.server";
import { parseNovelForm } from "~/lib/novel/validation";
import { RATE_LIMIT_MESSAGE, isRateLimited } from "~/lib/rate-limit.server";

export function meta({}: Route.MetaArgs) {
  return [{ title: "สร้างเรื่องใหม่ — readable" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  return { categories: await listCategories() };
}

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireUser(request);
  if (await isRateLimited("write", user.id)) return { error: RATE_LIMIT_MESSAGE };
  const form = await request.formData();
  const categories = await listCategories();
  const parsed = parseNovelForm(
    form,
    categories.map((c) => c.id),
  );
  if ("error" in parsed) return { error: parsed.error };
  const { tags, ...values } = parsed.value;

  const db = getDb();
  const [novel] = await db
    .insert(novels)
    .values({ ...values, authorId: user.id })
    .returning({ id: novels.id });
  await setNovelTags(novel.id, tags);
  if (user.role === "reader") {
    await db.update(users).set({ role: "writer" }).where(eq(users.id, user.id));
  }

  const cover = form.get("cover");
  if (cover instanceof File && cover.size > 0) {
    const res = await uploadCover(novel.id, cover, null);
    if ("key" in res) await db.update(novels).set({ coverKey: res.key }).where(eq(novels.id, novel.id));
    else return redirect(`/write/${novel.id}?coverError=1`);
  }
  return redirect(`/write/${novel.id}?created=1`);
}

export default function NewNovel({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">สร้างเรื่องใหม่</h1>
      <NovelForm
        categories={loaderData.categories}
        submitLabel="สร้างเรื่อง"
        error={actionData?.error}
      />
      <p className="mt-4 text-sm text-muted">
        เรื่องจะเป็นร่างไว้ก่อน เพิ่มตอนแล้วค่อยกดเผยแพร่ในหน้าถัดไป
      </p>
    </div>
  );
}
