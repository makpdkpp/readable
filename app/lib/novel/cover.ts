export const MAX_COVER_BYTES = 2 * 1024 * 1024;

const TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

export type CoverExt = keyof typeof TYPES;

/** ดูชนิดไฟล์จาก byte แรกๆ ไม่เชื่อนามสกุลหรือ Content-Type ที่ browser ส่งมา */
export function sniffImage(bytes: Uint8Array): { ext: CoverExt; contentType: string } | null {
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", contentType: TYPES.jpg };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return { ext: "png", contentType: TYPES.png };
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { ext: "webp", contentType: TYPES.webp };
  return null;
}

/** key ใน R2 ต้องเป็นรูปแบบนี้เท่านั้น กันการขอไฟล์อื่นผ่าน /covers/... */
export const COVER_KEY_RE = /^\d+-[a-f0-9]{16}\.(jpg|png|webp)$/;

export function coverUrl(key: string | null | undefined): string | null {
  return key ? `/covers/${key}` : null;
}
