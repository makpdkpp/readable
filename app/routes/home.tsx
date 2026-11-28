import { desc, eq, inArray, and, ne } from "drizzle-orm";

import type { Route } from "./+types/home";
import { getDb } from "~/db/client";
import { novels, users } from "~/db/schema";
import { getCurrentUser } from "~/lib/auth/session.server";
import { canRead } from "~/lib/moderation";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "readable — อ่านนิยายฟรี" },
    { name: "description", content: "อ่านและเขียนนิยายภาษาไทยได้ฟรี" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const db = getDb();
  // เรื่อง 18+ แสดงเฉพาะคนที่ล็อกอินและอายุ 18 ปีขึ้นไป
  const showAdult = canRead("18+", await getCurrentUser(request));
  const latest = await db
    .select({
      id: novels.id,
      title: novels.title,
      synopsis: novels.synopsis,
      author: users.displayName,
    })
    .from(novels)
    .innerJoin(users, eq(novels.authorId, users.id))
    .where(
      and(
        inArray(novels.status, ["ongoing", "completed"]),
        showAdult ? undefined : ne(novels.rating, "18+"),
      ),
    )
    .orderBy(desc(novels.updatedAt))
    .limit(20);
  return { latest };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { latest } = loaderData;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">อัปเดตล่าสุด</h1>
      {latest.length === 0 ? (
        <p className="text-stone-500">ยังไม่มีนิยายในระบบ</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {latest.map((n) => (
            <li key={n.id} className="rounded-lg border border-stone-200 dark:border-stone-800 p-4">
              <h2 className="font-semibold">{n.title}</h2>
              <p className="text-sm text-stone-500">โดย {n.author}</p>
              <p className="mt-2 text-sm line-clamp-3">{n.synopsis}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
