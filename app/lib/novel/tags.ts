export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;

/** "รักใส, โรงเรียน,#ตลก" → ["รักใส", "โรงเรียน", "ตลก"] ตัดซ้ำและตัดที่ยาวเกิน */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of input.split(/[,，\n]/)) {
    const tag = raw.trim().replace(/^#+/, "").replace(/\s+/g, " ").toLowerCase();
    if (!tag || tag.length > MAX_TAG_LENGTH) continue;
    seen.add(tag);
    if (seen.size >= MAX_TAGS) break;
  }
  return [...seen];
}
