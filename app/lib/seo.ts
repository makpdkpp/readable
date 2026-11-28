export const SITE_NAME = "readable";

type MetaDescriptor =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string }
  | { tagName: "link"; rel: string; href: string };

/**
 * meta tag มาตรฐานของทุกหน้าสาธารณะ: title, description, canonical, OpenGraph (Facebook/LINE) และ Twitter
 * `image` ต้องเป็น URL เต็ม เพราะ Facebook/LINE ไม่รับ path
 */
export function pageMeta(opts: {
  title: string;
  description?: string;
  url: string;
  image?: string | null;
  type?: "website" | "book" | "article";
  noindex?: boolean;
}): MetaDescriptor[] {
  const description = opts.description ? truncate(opts.description, 160) : undefined;
  return [
    { title: opts.title },
    ...(description ? [{ name: "description", content: description }] : []),
    { tagName: "link", rel: "canonical", href: opts.url },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: "th_TH" },
    { property: "og:type", content: opts.type ?? "website" },
    { property: "og:title", content: opts.title },
    ...(description ? [{ property: "og:description", content: description }] : []),
    { property: "og:url", content: opts.url },
    ...(opts.image ? [{ property: "og:image", content: opts.image }] : []),
    { name: "twitter:card", content: opts.image ? "summary_large_image" : "summary" },
    ...(opts.noindex ? [{ name: "robots", content: "noindex" }] : []),
  ];
}

/** ตัดข้อความให้ไม่เกิน max ตัวอักษร (นับแบบ code point ไม่ตัดกลางสระ/วรรณยุกต์ที่เป็นคู่ surrogate) */
export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const chars = [...clean];
  return chars.length <= max ? clean : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}

/** ข้อความล้วนจาก HTML ของตอน ใช้ทำคำอธิบายหน้า */
export function htmlToText(html: string): string {
  return html
    .replace(/<\/(p|h[1-6]|li|blockquote)>|<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const xmlEscape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

export function sitemapXml(entries: { loc: string; lastmod?: Date | null }[]): string {
  const urls = entries
    .map(
      (e) =>
        `<url><loc>${xmlEscape(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod.toISOString().slice(0, 10)}</lastmod>` : ""}</url>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}
