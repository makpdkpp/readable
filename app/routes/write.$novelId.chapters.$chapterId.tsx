import { and, eq, gt, sql } from "drizzle-orm";
import { useEffect, useRef, useState } from "react";
import { Form, Link, redirect, useNavigation } from "react-router";

import type { Route } from "./+types/write.$novelId.chapters.$chapterId";
import { ChapterEditor } from "~/components/chapter-editor";
import {
  ChapterStatusBadge,
  Notice,
  dangerButton,
  inputClass,
  primaryButton,
  secondaryButton,
} from "~/components/novel-ui";
import { getDb } from "~/db/client";
import { chapters, novels, type Chapter } from "~/db/schema";
import { assertSameOrigin, requireUser } from "~/lib/auth/session.server";
import { isChapterLive } from "~/lib/moderation";
import { requireOwnChapter, requireOwnNovel } from "~/lib/novel/access.server";
import {
  EMPTY_DOC,
  countWords,
  parseContent,
  plainText,
  renderContentHtml,
  type JSONNode,
} from "~/lib/novel/content";
import { formatThaiDateTime, parseBangkokLocal, toBangkokLocal } from "~/lib/novel/time";
import { MAX_CHAPTER_TITLE, parseChapterTitle } from "~/lib/novel/validation";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [
    { title: `${data?.chapter.title ?? "เขียนตอน"} — readable` },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const novel = await requireOwnNovel(user, params.novelId);
  const chapter = await requireOwnChapter(novel.id, params.chapterId);
  return {
    novel: { id: novel.id, title: novel.title },
    chapter: {
      id: chapter.id,
      number: chapter.number,
      title: chapter.title,
      status: chapter.status,
      publishAt: chapter.publishAt,
      wordCount: chapter.wordCount,
      contentJson: chapter.contentJson,
      updatedAt: chapter.updatedAt,
      live: isChapterLive(chapter),
    },
  };
}

type ActionResult = { error?: string; ok?: string };

export async function action({ request, params }: Route.ActionArgs): Promise<ActionResult | Response> {
  assertSameOrigin(request);
  const user = await requireUser(request);
  const novel = await requireOwnNovel(user, params.novelId);
  const chapter = await requireOwnChapter(novel.id, params.chapterId);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const db = getDb();

  if (intent === "delete") {
    await db.delete(chapters).where(eq(chapters.id, chapter.id));
    // เลื่อนเลขตอนที่อยู่ถัดไปขึ้นมา ไม่ให้เลขตอนขาดช่วง
    await db
      .update(chapters)
      .set({ number: sql`${chapters.number} - 1` })
      .where(and(eq(chapters.novelId, novel.id), gt(chapters.number, chapter.number)));
    return redirect(`/write/${novel.id}`);
  }

  const title = parseChapterTitle(form.get("title"));
  if (typeof title !== "string") return title;
  const doc = parseContent(String(form.get("contentJson") ?? ""));
  if (!doc) return { error: "เนื้อหายาวเกินไปหรือเสียหาย ลองแบ่งเป็นหลายตอน" };

  const now = new Date();
  const update: Partial<Chapter> = {
    title,
    contentJson: JSON.stringify(doc),
    contentHtml: renderContentHtml(doc),
    wordCount: countWords(plainText(doc)),
    updatedAt: now,
  };
  let ok = "บันทึกแล้ว";

  if (intent === "publish") {
    if (update.wordCount === 0) return { error: "ตอนนี้ยังไม่มีเนื้อหา" };
    update.status = "published";
    // เก็บเวลาเผยแพร่ครั้งแรกไว้ ถ้าแก้ตอนที่เผยแพร่แล้วจะไม่เปลี่ยน
    update.publishAt = isChapterLive(chapter, now) ? chapter.publishAt ?? now : now;
    ok = "เผยแพร่ตอนนี้แล้ว";
  } else if (intent === "schedule") {
    if (update.wordCount === 0) return { error: "ตอนนี้ยังไม่มีเนื้อหา" };
    const at = parseBangkokLocal(String(form.get("publishAt") ?? ""));
    if (!at) return { error: "กรุณาเลือกวันและเวลาที่จะเผยแพร่" };
    if (at <= now) return { error: "เวลาที่ตั้งต้องเป็นเวลาในอนาคต" };
    update.status = "scheduled";
    update.publishAt = at;
    ok = `ตั้งเวลาเผยแพร่ ${formatThaiDateTime(at)} แล้ว`;
  } else if (intent === "unpublish") {
    update.status = "draft";
    update.publishAt = null;
    ok = "ย้ายกลับเป็นร่างแล้ว นักอ่านจะไม่เห็นตอนนี้";
  } else if (intent !== "save") {
    return { error: "ไม่รู้จักคำสั่งนี้" };
  }

  await db.update(chapters).set(update).where(eq(chapters.id, chapter.id));
  if (intent === "publish" || intent === "schedule") {
    // หน้าแรกเรียงเรื่องตามเวลาแก้ไขล่าสุด
    await db.update(novels).set({ updatedAt: update.publishAt ?? now }).where(eq(novels.id, novel.id));
  }
  return { ok };
}

export default function EditChapter({ loaderData, actionData }: Route.ComponentProps) {
  const { novel, chapter } = loaderData;
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";
  const [content, setContent] = useState(chapter.contentJson);
  const [dirty, setDirty] = useState(false);
  const [showSchedule, setShowSchedule] = useState(chapter.status === "scheduled");
  const initial = useRef<JSONNode>(
    (() => {
      try {
        const doc = JSON.parse(chapter.contentJson) as JSONNode;
        return doc.type === "doc" ? doc : EMPTY_DOC;
      } catch {
        return EMPTY_DOC;
      }
    })(),
  );

  // บันทึกสำเร็จแล้ว ไม่ต้องเตือนตอนออกจากหน้า
  useEffect(() => {
    if (actionData?.ok) setDirty(false);
  }, [actionData]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const submitting = (intent: string) =>
    busy && navigation.formData?.get("intent") === intent;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to={`/write/${novel.id}`} className="text-sm text-stone-500 hover:underline">
        ← {novel.title}
      </Link>

      <Form method="post" className="mt-4 space-y-4" onChange={() => setDirty(true)}>
        <input type="hidden" name="contentJson" value={content} />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-stone-500">ตอนที่ {chapter.number}</span>
          <ChapterStatusBadge status={chapter.status} live={chapter.live} />
          {chapter.status === "scheduled" && !chapter.live && chapter.publishAt && (
            <span className="text-stone-500">จะเผยแพร่ {formatThaiDateTime(chapter.publishAt)}</span>
          )}
          <span className="ml-auto text-stone-500">
            {dirty ? "ยังไม่ได้บันทึก" : `บันทึกล่าสุด ${formatThaiDateTime(chapter.updatedAt)}`}
          </span>
        </div>
        <Notice {...(actionData ?? {})} />
        <input
          name="title"
          required
          maxLength={MAX_CHAPTER_TITLE}
          defaultValue={chapter.title}
          aria-label="ชื่อตอน"
          className={`${inputClass} text-xl font-bold`}
        />
        <ChapterEditor
          initialContent={initial.current}
          onChange={(json) => {
            setContent(json);
            setDirty(true);
          }}
        />

        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t border-stone-200 dark:border-stone-800 bg-white/95 dark:bg-gray-950/95 px-4 py-3 backdrop-blur">
          <button type="submit" name="intent" value="save" disabled={busy} className={secondaryButton}>
            {submitting("save") ? "กำลังบันทึก..." : chapter.live ? "บันทึกการแก้ไข" : "บันทึกร่าง"}
          </button>
          {!chapter.live && (
            <>
              <button type="submit" name="intent" value="publish" disabled={busy} className={primaryButton}>
                {submitting("publish") ? "กำลังเผยแพร่..." : "เผยแพร่เลย"}
              </button>
              <button
                type="button"
                onClick={() => setShowSchedule((v) => !v)}
                className={secondaryButton}
              >
                ตั้งเวลาเผยแพร่
              </button>
            </>
          )}
          {(chapter.live || chapter.status === "scheduled") && (
            <button type="submit" name="intent" value="unpublish" disabled={busy} className={dangerButton}>
              กลับเป็นร่าง
            </button>
          )}
          <Link to={`/novel/${novel.id}/chapter/${chapter.id}`} target="_blank" className="ml-auto text-sm text-amber-700 hover:underline dark:text-amber-400">
            ดูตัวอย่าง
          </Link>
          {showSchedule && !chapter.live && (
            <div className="flex w-full flex-wrap items-end gap-2 pt-2">
              <label className="block">
                <span className="text-sm font-semibold">วันเวลาที่จะเผยแพร่ (เวลาไทย)</span>
                <input
                  type="datetime-local"
                  name="publishAt"
                  defaultValue={chapter.publishAt ? toBangkokLocal(new Date(chapter.publishAt)) : undefined}
                  className={inputClass}
                />
              </label>
              <button type="submit" name="intent" value="schedule" disabled={busy} className={primaryButton}>
                {submitting("schedule") ? "กำลังบันทึก..." : "ยืนยันเวลา"}
              </button>
            </div>
          )}
        </div>
      </Form>

      <Form
        method="post"
        className="mt-10 text-right"
        onSubmit={(e) => {
          if (!confirm(`ลบ "${chapter.title}" ถาวร? กู้คืนไม่ได้`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="intent" value="delete" />
        <button type="submit" disabled={busy} className={`${dangerButton} text-sm`}>
          ลบตอนนี้
        </button>
      </Form>
    </div>
  );
}
