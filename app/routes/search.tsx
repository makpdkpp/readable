import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { Form, Link } from "react-router";

import type { Route } from "./+types/search";
import { Cover, RatingBadge, inputClass, primaryButton } from "~/components/novel-ui";
import { getDb } from "~/db/client";
import { categories, novels, novelTags, tags, users } from "~/db/schema";
import { getCurrentUser } from "~/lib/auth/session.server";
import { PUBLIC_STATUSES, canRead } from "~/lib/moderation";
import { likePattern, normalizeQuery } from "~/lib/search";

export function meta({ loaderData }: Route.MetaArgs) {
  const label = loaderData?.q || (loaderData?.tag && `#${loaderData.tag}`) || loaderData?.category?.name;
  return [
    { title: `${label ? `${label} — ` : ""}ค้นหานิยาย | readable` },
    // หน้าผลค้นหาไม่ควรติด Google (เนื้อหาซ้ำกับหน้าเรื่อง)
    { name: "robots", content: "noindex, follow" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = normalizeQuery(url.searchParams.get("q"));
  const tag = normalizeQuery(url.searchParams.get("tag"));
  const catSlug = url.searchParams.get("cat") ?? "";
  const db = getDb();
  const allCategories = await db
    .select({ id: categories.id, slug: categories.slug, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.id));
  const category = allCategories.find((c) => c.slug === catSlug) ?? null;

  if (!q && !tag && !category) return { q, tag, category, categories: allCategories, results: null };

  const showAdult = canRead("18+", await getCurrentUser(request));
  const pattern = likePattern(q);
  // ชื่อเรื่อง ชื่อนักเขียน หรือแท็กใดแท็กหนึ่งมีคำค้นอยู่
  const textMatch = q
    ? sql`(${novels.title} like ${pattern} escape '\\'
        or ${users.displayName} like ${pattern} escape '\\'
        or exists (select 1 from ${novelTags} nt join ${tags} t on t.id = nt.tag_id
                   where nt.novel_id = ${novels.id} and t.name like ${pattern} escape '\\'))`
    : undefined;
  const tagMatch = tag
    ? sql`exists (select 1 from ${novelTags} nt join ${tags} t on t.id = nt.tag_id
                  where nt.novel_id = ${novels.id} and t.name = ${tag})`
    : undefined;

  const rows = await db
    .select({
      id: novels.id,
      title: novels.title,
      synopsis: novels.synopsis,
      coverKey: novels.coverKey,
      rating: novels.rating,
      status: novels.status,
      author: users.displayName,
      category: categories.name,
    })
    .from(novels)
    .innerJoin(users, eq(novels.authorId, users.id))
    .leftJoin(categories, eq(novels.categoryId, categories.id))
    .where(
      and(
        inArray(novels.status, [...PUBLIC_STATUSES]),
        showAdult ? undefined : ne(novels.rating, "18+"),
        category ? eq(novels.categoryId, category.id) : undefined,
        textMatch,
        tagMatch,
      ),
    )
    // ชื่อเรื่องตรงคำค้นขึ้นก่อน แล้วค่อยเรียงตามอัปเดตล่าสุด
    .orderBy(
      ...(q ? [desc(sql`${novels.title} like ${pattern} escape '\\'`)] : []),
      desc(novels.updatedAt),
    )
    .limit(50);

  const ids = rows.map((r) => r.id);
  const tagRows = ids.length
    ? await db
        .select({ novelId: novelTags.novelId, name: tags.name })
        .from(novelTags)
        .innerJoin(tags, eq(novelTags.tagId, tags.id))
        .where(inArray(novelTags.novelId, ids))
    : [];
  const results = rows.map((r) => ({
    ...r,
    tags: tagRows.filter((t) => t.novelId === r.id).map((t) => t.name),
  }));
  return { q, tag, category, categories: allCategories, results };
}

export default function Search({ loaderData }: Route.ComponentProps) {
  const { q, tag, category, categories: cats, results } = loaderData;
  const withParams = (p: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(p)) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `/search?${s}` : "/search";
  };
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <Form method="get" role="search" className="flex gap-2">
        <label htmlFor="search-q" className="sr-only">
          ค้นหา
        </label>
        <input
          id="search-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="ชื่อเรื่อง ชื่อนักเขียน หรือแท็ก"
          className={`${inputClass} mt-0!`}
          autoFocus={!results}
        />
        {category && <input type="hidden" name="cat" value={category.slug} />}
        {tag && <input type="hidden" name="tag" value={tag} />}
        <button type="submit" className={primaryButton}>
          ค้นหา
        </button>
      </Form>

      <nav aria-label="หมวด" className="flex flex-wrap gap-2">
        <Link
          to={withParams({ q, tag })}
          className={`tag-chip ${!category ? "tag-chip-active" : ""}`}
          aria-current={!category ? "page" : undefined}
        >
          ทุกหมวด
        </Link>
        {cats.map((c) => (
          <Link
            key={c.slug}
            to={withParams({ q, tag, cat: c.slug })}
            className={`tag-chip ${category?.slug === c.slug ? "tag-chip-active" : ""}`}
            aria-current={category?.slug === c.slug ? "page" : undefined}
          >
            {c.name}
          </Link>
        ))}
      </nav>

      {tag && (
        <p className="text-sm">
          แท็ก <span className="tag-chip">#{tag}</span>{" "}
          <Link to={withParams({ q, cat: category?.slug })} className="text-muted hover:underline">
            ล้างแท็ก
          </Link>
        </p>
      )}

      {results === null ? (
        <p className="text-muted">พิมพ์คำค้น หรือเลือกหมวดที่อยากอ่าน</p>
      ) : results.length === 0 ? (
        <p className="text-muted">ไม่พบนิยายที่ตรงกับการค้นหา</p>
      ) : (
        <>
          <h1 className="section-title">
            {results.length >= 50 ? "50+" : results.length} เรื่อง
          </h1>
          <ul className="card-list grid gap-4 sm:grid-cols-2">
            {results.map((n) => (
              <li key={n.id}>
                <div className="card flex h-full gap-4 p-4">
                  <Link to={`/novel/${n.id}`} className="shrink-0">
                    <Cover coverKey={n.coverKey} title={n.title} className="w-20" />
                  </Link>
                  <div className="min-w-0 space-y-1">
                    <h2 className="flex items-center gap-2 text-lg font-semibold leading-snug">
                      <Link to={`/novel/${n.id}`} className="hover:underline">
                        {n.title}
                      </Link>
                      <RatingBadge rating={n.rating} />
                    </h2>
                    <p className="text-sm text-muted">
                      โดย {n.author}
                      {n.category && <> · {n.category}</>}
                      {n.status === "completed" && <> · จบแล้ว</>}
                    </p>
                    <p className="text-sm line-clamp-2">{n.synopsis}</p>
                    {n.tags.length > 0 && (
                      <ul className="flex flex-wrap gap-1 pt-1">
                        {n.tags.slice(0, 5).map((t) => (
                          <li key={t}>
                            <Link to={withParams({ tag: t })} className="tag-chip text-xs!">
                              #{t}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
