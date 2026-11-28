import { asc, eq, max } from "drizzle-orm";
import { Form, Link, redirect, useNavigation } from "react-router";

import type { Route } from "./+types/write.$novelId";
import { NovelForm } from "~/components/novel-form";
import {
  ChapterStatusBadge,
  Cover,
  NovelStatusBadge,
  RatingBadge,
  dangerButton,
  primaryButton,
  secondaryButton,
  Notice,
} from "~/components/novel-ui";
import { getDb } from "~/db/client";
import { chapters, novels, type NovelStatus } from "~/db/schema";
import { assertSameOrigin, requireUser } from "~/lib/auth/session.server";
import { isChapterLive, isNovelPublic, statusOnPublish, statusOnRatingChange } from "~/lib/moderation";
import {
  getNovelTags,
  listCategories,
  requireOwnNovel,
  setNovelTags,
} from "~/lib/novel/access.server";
import { deleteCover, uploadCover } from "~/lib/novel/cover.server";
import { formatThaiDateTime } from "~/lib/novel/time";
import { parseNovelForm } from "~/lib/novel/validation";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [
    { title: `${data?.novel.title ?? "จัดการเรื่อง"} — readable` },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const novel = await requireOwnNovel(user, params.novelId);
  const rows = await getDb()
    .select({
      id: chapters.id,
      number: chapters.number,
      title: chapters.title,
      status: chapters.status,
      publishAt: chapters.publishAt,
      wordCount: chapters.wordCount,
    })
    .from(chapters)
    .where(eq(chapters.novelId, novel.id))
    .orderBy(asc(chapters.number));
  const now = new Date();
  const url = new URL(request.url);
  return {
    novel,
    tags: await getNovelTags(novel.id),
    categories: await listCategories(),
    chapters: rows.map((c) => ({ ...c, live: isChapterLive(c, now) })),
    created: url.searchParams.has("created"),
    coverError: url.searchParams.has("coverError"),
  };
}

type ActionResult = { form: "details" | "status" | "cover"; error?: string; ok?: string };

export async function action({ request, params }: Route.ActionArgs): Promise<ActionResult | Response> {
  assertSameOrigin(request);
  const user = await requireUser(request);
  const novel = await requireOwnNovel(user, params.novelId);
  const form = await request.formData();
  const db = getDb();
  const intent = String(form.get("intent"));
  const setStatus = async (status: NovelStatus) =>
    db.update(novels).set({ status, updatedAt: new Date() }).where(eq(novels.id, novel.id));

  switch (intent) {
    case "details": {
      const categories = await listCategories();
      const parsed = parseNovelForm(
        form,
        categories.map((c) => c.id),
      );
      if ("error" in parsed) return { form: "details", error: parsed.error };
      const { tags, ...values } = parsed.value;
      const status = statusOnRatingChange(novel.status, novel.rating, values.rating);
      const update: Partial<typeof novels.$inferInsert> = { ...values, status, updatedAt: new Date() };

      const cover = form.get("cover");
      let coverError: string | undefined;
      if (cover instanceof File && cover.size > 0) {
        const res = await uploadCover(novel.id, cover, novel.coverKey);
        if ("key" in res) update.coverKey = res.key;
        else coverError = res.error;
      }
      await db.update(novels).set(update).where(eq(novels.id, novel.id));
      await setNovelTags(novel.id, tags);
      if (coverError) return { form: "details", error: `บันทึกข้อมูลแล้ว แต่${coverError}` };
      if (status === "pending_review" && novel.status !== "pending_review") {
        return { form: "details", ok: "บันทึกแล้ว เรื่องเปลี่ยนเป็น 18+ จึงต้องรอ admin อนุมัติใหม่" };
      }
      return { form: "details", ok: "บันทึกแล้ว" };
    }
    case "remove-cover": {
      if (novel.coverKey) await deleteCover(novel.coverKey);
      await db.update(novels).set({ coverKey: null }).where(eq(novels.id, novel.id));
      return { form: "cover", ok: "ลบรูปปกแล้ว" };
    }
    case "publish": {
      if (novel.status !== "draft" && novel.status !== "rejected") break;
      const status = statusOnPublish(novel.rating);
      await setStatus(status);
      return {
        form: "status",
        ok: status === "pending_review" ? "ส่งให้ admin ตรวจแล้ว" : "เผยแพร่เรื่องแล้ว",
      };
    }
    case "unpublish": {
      if (!isNovelPublic(novel.status) && novel.status !== "pending_review") break;
      await setStatus("draft");
      return { form: "status", ok: "ซ่อนเรื่องจากนักอ่านแล้ว" };
    }
    case "complete": {
      if (novel.status !== "ongoing") break;
      await setStatus("completed");
      return { form: "status", ok: "ตั้งเป็นจบแล้ว" };
    }
    case "reopen": {
      if (novel.status !== "completed") break;
      await setStatus("ongoing");
      return { form: "status", ok: "ตั้งเป็นยังไม่จบ" };
    }
    case "new-chapter": {
      const [row] = await db
        .select({ n: max(chapters.number) })
        .from(chapters)
        .where(eq(chapters.novelId, novel.id));
      const number = (row?.n ?? 0) + 1;
      const [chapter] = await db
        .insert(chapters)
        .values({ novelId: novel.id, number, title: `ตอนที่ ${number}` })
        .returning({ id: chapters.id });
      return redirect(`/write/${novel.id}/chapters/${chapter.id}`);
    }
  }
  return { form: "status", error: "ทำรายการนี้ไม่ได้ในสถานะปัจจุบัน" };
}

function StatusPanel({
  status,
  reviewNote,
  hasLiveChapter,
}: {
  status: NovelStatus;
  reviewNote: string | null;
  hasLiveChapter: boolean;
}) {
  const busy = useNavigation().state === "submitting";
  const btn = (intent: string, label: string, cls = secondaryButton) => (
    <Form method="post">
      <input type="hidden" name="intent" value={intent} />
      <button type="submit" disabled={busy} className={cls}>
        {label}
      </button>
    </Form>
  );
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">สถานะ</span>
        <NovelStatusBadge status={status} />
      </div>
      {status === "draft" && (
        <p className="text-sm text-muted">
          {hasLiveChapter
            ? "นักอ่านยังไม่เห็นเรื่องนี้ กดเผยแพร่เมื่อพร้อม"
            : "นักอ่านยังไม่เห็นเรื่องนี้ แนะนำให้เผยแพร่ตอนแรกก่อนแล้วค่อยเผยแพร่เรื่อง"}
        </p>
      )}
      {status === "pending_review" && (
        <p className="text-sm text-muted">
          เรื่อง 18+ ต้องให้ admin อนุมัติก่อนนักอ่านจะเห็น ระหว่างนี้เขียนตอนต่อได้ตามปกติ
        </p>
      )}
      {(status === "rejected" || status === "hidden") && reviewNote && (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          เหตุผลจาก admin: {reviewNote}
        </p>
      )}
      {status === "hidden" && (
        <p className="text-sm text-muted">ติดต่อ admin หากต้องการให้เปิดเรื่องนี้อีกครั้ง</p>
      )}
      <div className="flex flex-wrap gap-2">
        {status === "draft" && btn("publish", "เผยแพร่เรื่อง", primaryButton)}
        {status === "rejected" && btn("publish", "แก้แล้ว ส่งตรวจอีกครั้ง", primaryButton)}
        {status === "ongoing" && btn("complete", "ตั้งเป็นจบแล้ว")}
        {status === "completed" && btn("reopen", "ตั้งเป็นยังไม่จบ")}
        {(status === "ongoing" || status === "completed" || status === "pending_review") &&
          btn("unpublish", "กลับเป็นร่าง (ซ่อนจากนักอ่าน)", dangerButton)}
      </div>
    </div>
  );
}

export default function ManageNovel({ loaderData, actionData }: Route.ComponentProps) {
  const { novel, tags, categories, chapters: list, created, coverError } = loaderData;
  const busy = useNavigation().state === "submitting";
  const msg = (f: ActionResult["form"]) => (actionData?.form === f ? actionData : undefined);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      <div>
        <Link to="/write" className="text-sm text-muted hover:underline">
          ← นิยายของฉัน
        </Link>
        <div className="mt-3 flex gap-4">
          <Cover coverKey={novel.coverKey} title={novel.title} className="w-24" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{novel.title}</h1>
              <RatingBadge rating={novel.rating} />
            </div>
            <Link to={`/novel/${novel.id}`} className="text-sm text-accent hover:underline">
              ดูหน้าเรื่องแบบที่นักอ่านเห็น
            </Link>
            {novel.coverKey && (
              <Form method="post">
                <input type="hidden" name="intent" value="remove-cover" />
                <button type="submit" disabled={busy} className="text-sm text-muted hover:underline">
                  ลบรูปปก
                </button>
              </Form>
            )}
          </div>
        </div>
      </div>

      {created && <Notice ok="สร้างเรื่องแล้ว เพิ่มตอนแรกได้เลย" />}
      {coverError && <Notice error="สร้างเรื่องแล้ว แต่อัปโหลดรูปปกไม่สำเร็จ ลองเลือกรูปใหม่อีกครั้ง" />}
      <Notice {...(msg("cover") ?? {})} />

      <section className="card p-6 space-y-3">
        <Notice {...(msg("status") ?? {})} />
        <StatusPanel
          status={novel.status}
          reviewNote={novel.reviewNote}
          hasLiveChapter={list.some((c) => c.live)}
        />
      </section>

      <section className="card p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">ตอนทั้งหมด ({list.length})</h2>
          <Form method="post">
            <input type="hidden" name="intent" value="new-chapter" />
            <button type="submit" disabled={busy} className={primaryButton}>
              + เขียนตอนใหม่
            </button>
          </Form>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-muted">ยังไม่มีตอน</p>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/write/${novel.id}/chapters/${c.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:bg-subtle"
                >
                  <span className="w-12 text-sm text-muted">#{c.number}</span>
                  <span className="flex-1 font-medium">{c.title}</span>
                  <ChapterStatusBadge status={c.status} live={c.live} />
                  {c.status === "scheduled" && !c.live && c.publishAt && (
                    <span className="text-xs text-muted">{formatThaiDateTime(c.publishAt)}</span>
                  )}
                  <span className="text-xs text-muted">{c.wordCount.toLocaleString("th-TH")} คำ</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-lg font-semibold">ข้อมูลเรื่อง</h2>
        <NovelForm
          key={novel.updatedAt.toString()}
          categories={categories}
          defaults={{ ...novel, tags }}
          submitLabel="บันทึกข้อมูลเรื่อง"
          error={msg("details")?.error}
          ok={msg("details")?.ok}
        />
      </section>
    </div>
  );
}
