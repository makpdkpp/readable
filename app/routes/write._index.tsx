import { desc, eq, sql } from "drizzle-orm";
import { Link } from "react-router";

import type { Route } from "./+types/write._index";
import { Cover, NovelStatusBadge, RatingBadge, primaryButton } from "~/components/novel-ui";
import { getDb } from "~/db/client";
import { chapters, novels } from "~/db/schema";
import { requireUser } from "~/lib/auth/session.server";
import { formatThaiDate } from "~/lib/novel/time";

export function meta({}: Route.MetaArgs) {
  return [{ title: "นิยายของฉัน — readable" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const rows = await getDb()
    .select({
      id: novels.id,
      title: novels.title,
      coverKey: novels.coverKey,
      rating: novels.rating,
      status: novels.status,
      updatedAt: novels.updatedAt,
      chapterCount: sql<number>`(select count(*) from ${chapters} where ${chapters.novelId} = ${novels.id})`,
    })
    .from(novels)
    .where(eq(novels.authorId, user.id))
    .orderBy(desc(novels.updatedAt));
  return { novels: rows };
}

export default function WriterDashboard({ loaderData }: Route.ComponentProps) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">นิยายของฉัน</h1>
        <Link to="/write/new" className={primaryButton}>
          + สร้างเรื่องใหม่
        </Link>
      </div>
      {loaderData.novels.length === 0 ? (
        <div className="card border-dashed! p-10 text-center text-muted">
          ยังไม่มีเรื่อง เริ่มสร้างเรื่องแรกได้เลย
        </div>
      ) : (
        <ul className="card-list space-y-3">
          {loaderData.novels.map((n) => (
            <li key={n.id}>
              <Link
                to={`/write/${n.id}`}
                className="card flex gap-4 p-3"
              >
                <Cover coverKey={n.coverKey} title={n.title} className="w-16" />
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-semibold">{n.title}</h2>
                    <RatingBadge rating={n.rating} />
                  </div>
                  <NovelStatusBadge status={n.status} />
                  <p className="text-sm text-muted">
                    {n.chapterCount} ตอน · แก้ไขล่าสุด {formatThaiDate(n.updatedAt)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
