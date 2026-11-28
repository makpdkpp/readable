import type { Route } from "./+types/covers.$key";
import { getCover } from "~/lib/novel/cover.server";

// ชื่อไฟล์ปกสุ่มใหม่ทุกครั้งที่เปลี่ยน จึงให้ browser แคชได้นาน
export async function loader({ params }: Route.LoaderArgs) {
  const obj = await getCover(params.key);
  if (!obj) return new Response("Not Found", { status: 404 });
  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: obj.httpEtag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
