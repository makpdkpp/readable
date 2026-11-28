import type { Rating } from "~/db/schema";
import { parseTags } from "./tags";

export const MAX_TITLE = 120;
export const MAX_SYNOPSIS = 2000;
export const MAX_CHAPTER_TITLE = 150;

export type NovelInput = {
  title: string;
  synopsis: string;
  categoryId: number | null;
  rating: Rating;
  tags: string[];
};

const RATINGS: Rating[] = ["all", "13+", "18+"];

export function parseNovelForm(
  form: FormData,
  categoryIds: number[],
): { value: NovelInput } | { error: string } {
  const title = String(form.get("title") ?? "").trim().replace(/\s+/g, " ");
  if (!title) return { error: "กรุณาใส่ชื่อเรื่อง" };
  if (title.length > MAX_TITLE) return { error: `ชื่อเรื่องยาวได้ไม่เกิน ${MAX_TITLE} ตัวอักษร` };

  const synopsis = String(form.get("synopsis") ?? "").trim().replace(/\r\n/g, "\n");
  if (synopsis.length > MAX_SYNOPSIS)
    return { error: `เรื่องย่อยาวได้ไม่เกิน ${MAX_SYNOPSIS} ตัวอักษร` };

  const rawCategory = String(form.get("categoryId") ?? "");
  const categoryId = rawCategory ? Number(rawCategory) : null;
  if (categoryId !== null && !categoryIds.includes(categoryId)) return { error: "หมวดไม่ถูกต้อง" };

  const rating = String(form.get("rating") ?? "all") as Rating;
  if (!RATINGS.includes(rating)) return { error: "เรตไม่ถูกต้อง" };

  return {
    value: { title, synopsis, categoryId, rating, tags: parseTags(String(form.get("tags") ?? "")) },
  };
}

export function parseChapterTitle(raw: unknown): string | { error: string } {
  const title = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!title) return { error: "กรุณาใส่ชื่อตอน" };
  if (title.length > MAX_CHAPTER_TITLE)
    return { error: `ชื่อตอนยาวได้ไม่เกิน ${MAX_CHAPTER_TITLE} ตัวอักษร` };
  return title;
}
