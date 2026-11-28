import { Form, useNavigation } from "react-router";

import type { Rating } from "~/db/schema";
import { MAX_SYNOPSIS, MAX_TITLE } from "~/lib/novel/validation";
import { Notice, inputClass, primaryButton } from "./novel-ui";

type Defaults = {
  title: string;
  synopsis: string;
  categoryId: number | null;
  rating: Rating;
  tags: string[];
};

const RATING_OPTIONS: { value: Rating; label: string; hint: string }[] = [
  { value: "all", label: "ทั่วไป", hint: "อ่านได้ทุกวัย" },
  { value: "13+", label: "13+", hint: "มีเนื้อหาที่เด็กเล็กไม่ควรอ่าน" },
  {
    value: "18+",
    label: "18+",
    hint: "ต้องให้ admin อนุมัติก่อนขึ้นเว็บ และเฉพาะผู้ที่อายุ 18 ปีขึ้นไปเท่านั้นที่อ่านได้",
  },
];

export function NovelForm({
  categories,
  defaults,
  submitLabel,
  error,
  ok,
}: {
  categories: { id: number; name: string }[];
  defaults?: Defaults;
  submitLabel: string;
  error?: string;
  ok?: string;
}) {
  const busy = useNavigation().state === "submitting";
  return (
    <Form method="post" encType="multipart/form-data" className="space-y-5">
      <input type="hidden" name="intent" value="details" />
      <Notice error={error} ok={ok} />
      <label className="block">
        <span className="text-sm font-semibold">ชื่อเรื่อง</span>
        <input name="title" required maxLength={MAX_TITLE} defaultValue={defaults?.title} className={inputClass} />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">เรื่องย่อ</span>
        <textarea
          name="synopsis"
          rows={6}
          maxLength={MAX_SYNOPSIS}
          defaultValue={defaults?.synopsis}
          className={inputClass}
        />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold">หมวด</span>
          <select name="categoryId" defaultValue={defaults?.categoryId ?? ""} className={inputClass}>
            <option value="">ไม่ระบุ</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold">แท็ก</span>
          <input
            name="tags"
            defaultValue={defaults?.tags.join(", ")}
            placeholder="เช่น รักใส, โรงเรียน, ตลก"
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-stone-500">คั่นด้วยจุลภาค ได้สูงสุด 10 แท็ก</span>
        </label>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">เรตเนื้อหา</legend>
        <div className="mt-2 space-y-2">
          {RATING_OPTIONS.map((r) => (
            <label key={r.value} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="rating"
                value={r.value}
                defaultChecked={(defaults?.rating ?? "all") === r.value}
                className="mt-1 accent-amber-600"
              />
              <span>
                <span className="font-semibold">{r.label}</span>{" "}
                <span className="text-stone-500">{r.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="text-sm font-semibold">รูปปก</span>
        <input
          name="cover"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:font-semibold dark:file:bg-stone-800"
        />
        <span className="mt-1 block text-xs text-stone-500">
          JPG, PNG หรือ WebP ไม่เกิน 2 MB แนะนำสัดส่วน 2:3 เช่น 800×1200
        </span>
      </label>
      <button type="submit" disabled={busy} className={primaryButton}>
        {busy ? "กำลังบันทึก..." : submitLabel}
      </button>
    </Form>
  );
}
