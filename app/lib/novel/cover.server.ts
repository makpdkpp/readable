import { env } from "cloudflare:workers";

import { COVER_KEY_RE, MAX_COVER_BYTES, sniffImage } from "./cover";

export type CoverResult = { key: string } | { error: string };

/** อัปโหลดปกขึ้น R2 คืน key ใหม่ ถ้ามีปกเดิมจะลบทิ้ง */
export async function uploadCover(
  novelId: number,
  file: File,
  oldKey: string | null,
): Promise<CoverResult> {
  if (file.size > MAX_COVER_BYTES) return { error: "รูปปกต้องไม่เกิน 2 MB" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return { error: "รูปปกต้องเป็นไฟล์ JPG, PNG หรือ WebP" };
  const rand = [...crypto.getRandomValues(new Uint8Array(8))]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  const key = `${novelId}-${rand}.${type.ext}`;
  await env.COVERS.put(key, bytes, { httpMetadata: { contentType: type.contentType } });
  if (oldKey) await deleteCover(oldKey);
  return { key };
}

export async function deleteCover(key: string) {
  if (COVER_KEY_RE.test(key)) await env.COVERS.delete(key);
}

export async function getCover(key: string) {
  if (!COVER_KEY_RE.test(key)) return null;
  return env.COVERS.get(key);
}
