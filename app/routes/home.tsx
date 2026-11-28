import { desc, eq, inArray, and, ne } from "drizzle-orm";
import { Form, Link } from "react-router";

import type { Route } from "./+types/home";
import { Cover, RatingBadge, inputClass, primaryButton } from "~/components/novel-ui";
import { getDb } from "~/db/client";
import { novels, users } from "~/db/schema";
import { getCurrentUser } from "~/lib/auth/session.server";
import { canRead } from "~/lib/moderation";
import { pageMeta } from "~/lib/seo";

export function meta({ loaderData }: Route.MetaArgs) {
  return pageMeta({
    title: "readable — อ่านนิยายฟรี",
    description: "อ่านและเขียนนิยายภาษาไทยได้ฟรี ค้นหาเรื่องตามหมวดและแท็ก เก็บเข้าชั้นหนังสือ คอมเมนต์คุยกับนักเขียน",
    url: `${loaderData?.origin ?? ""}/`,
  });
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
      coverKey: novels.coverKey,
      rating: novels.rating,
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
  return { latest, origin: new URL(request.url).origin };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { latest } = loaderData;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Form method="get" action="/search" role="search" className="mb-8 flex gap-2">
        <label htmlFor="home-search" className="sr-only">
          ค้นหานิยาย
        </label>
        <input
          id="home-search"
          name="q"
          type="search"
          placeholder="ค้นหาชื่อเรื่อง ชื่อนักเขียน หรือแท็ก"
          className={`${inputClass} mt-0!`}
        />
        <button type="submit" className={primaryButton}>
          ค้นหา
        </button>
      </Form>
      <h1 className="section-title mb-6">อัปเดตล่าสุด</h1>
      {latest.length === 0 ? (
        <p className="text-muted">ยังไม่มีนิยายในระบบ</p>
      ) : (
        <ul className="card-list grid gap-4 sm:grid-cols-2">
          {latest.map((n) => (
            <li key={n.id}>
              <Link
                to={`/novel/${n.id}`}
                className="card flex gap-4 p-4"
              >
                <Cover coverKey={n.coverKey} title={n.title} className="w-20" />
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-lg font-semibold leading-snug">
                    {n.title} <RatingBadge rating={n.rating} />
                  </h2>
                  <p className="text-sm text-muted">โดย {n.author}</p>
                  <p className="mt-2 text-sm line-clamp-3">{n.synopsis}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
