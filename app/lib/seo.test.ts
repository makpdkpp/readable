import { describe, expect, it } from "vitest";

import { htmlToText, pageMeta, sitemapXml, truncate } from "./seo";

describe("pageMeta", () => {
  it("ใส่ OpenGraph ครบและ noindex เมื่อขอ", () => {
    const m = pageMeta({ title: "ก", description: "ข", url: "https://x/novel/1", image: "https://x/c.jpg", noindex: true });
    expect(m).toContainEqual({ property: "og:image", content: "https://x/c.jpg" });
    expect(m).toContainEqual({ tagName: "link", rel: "canonical", href: "https://x/novel/1" });
    expect(m).toContainEqual({ name: "robots", content: "noindex" });
  });
  it("ไม่มีรูป ไม่ใส่ og:image และไม่ noindex", () => {
    const m = pageMeta({ title: "ก", url: "https://x/" });
    expect(m.some((t) => "property" in t && t.property === "og:image")).toBe(false);
    expect(m.some((t) => "name" in t && t.name === "robots")).toBe(false);
  });
});

describe("truncate", () => {
  it("ไม่ตัดถ้าสั้นพอ", () => expect(truncate("  สวัสดี  ครับ ", 20)).toBe("สวัสดี ครับ"));
  it("ตัดแล้วเติม …", () => expect(truncate("กขคงจฉ", 4)).toBe("กขค…"));
});

describe("htmlToText", () => {
  it("ลบแท็กและถอดรหัส entity", () =>
    expect(htmlToText("<p>ฝน &amp; ฟ้า</p><p>&lt;เสียง&gt;<br>ดัง</p>")).toBe("ฝน & ฟ้า <เสียง> ดัง"));
});

describe("sitemapXml", () => {
  it("escape URL และใส่ lastmod", () => {
    const xml = sitemapXml([{ loc: "https://x/search?a=1&b=2", lastmod: new Date("2026-11-28T10:00:00Z") }]);
    expect(xml).toContain("<loc>https://x/search?a=1&amp;b=2</loc><lastmod>2026-11-28</lastmod>");
  });
});
