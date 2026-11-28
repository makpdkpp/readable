import { describe, expect, it } from "vitest";

import { countWords, parseContent, plainText, renderContentHtml } from "./content";
import { COVER_KEY_RE, sniffImage } from "./cover";
import { parseTags } from "./tags";
import { parseBangkokLocal, toBangkokLocal } from "./time";
import { parseNovelForm } from "./validation";

describe("renderContentHtml", () => {
  it("แปลง node และ mark ที่รู้จัก", () => {
    const html = renderContentHtml({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2, textAlign: "center" }, content: [{ type: "text", text: "บทนำ" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "สวัสดี " },
            { type: "text", text: "โลก", marks: [{ type: "bold" }, { type: "italic" }] },
            { type: "hardBreak" },
          ],
        },
        { type: "horizontalRule" },
      ],
    });
    expect(html).toBe(
      '<h2 style="text-align:center">บทนำ</h2><p>สวัสดี <strong><em>โลก</em></strong><br></p><hr>',
    );
  });

  it("escape ข้อความ และไม่ยอมให้แทรก HTML หรือ attribute แปลกๆ", () => {
    const html = renderContentHtml({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: 'center"><script>alert(1)</script>' },
          content: [
            { type: "text", text: '<img src=x onerror="alert(1)">' },
            { type: "text", text: "ลิงก์", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
          ],
        },
        { type: "iframe", attrs: { src: "https://evil" }, content: [{ type: "text", text: "x" }] },
      ],
    });
    expect(html).toBe('<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;ลิงก์</p>x');
  });

  it("ทนข้อมูลเสีย", () => {
    expect(renderContentHtml({ type: "doc", content: [null, 5, { type: "paragraph", content: "x" }] as never })).toBe(
      "<p></p>",
    );
  });
});

describe("parseContent", () => {
  it("รับเฉพาะเอกสาร Tiptap", () => {
    expect(parseContent('{"type":"doc","content":[]}')).toEqual({ type: "doc", content: [] });
    expect(parseContent('{"type":"paragraph"}')).toBeNull();
    expect(parseContent("not json")).toBeNull();
    expect(parseContent(JSON.stringify({ type: "doc", text: "ก".repeat(200_000) }))).toBeNull();
  });
});

describe("countWords", () => {
  it("นับคำภาษาไทยที่ไม่มีช่องว่าง", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "ฉันกินข้าว" }] },
        { type: "paragraph", content: [{ type: "text", text: "hello world" }] },
      ],
    };
    expect(plainText(doc)).toBe("ฉันกินข้าว\nhello world");
    expect(countWords(plainText(doc))).toBe(5);
    expect(countWords("")).toBe(0);
  });
});

describe("parseTags", () => {
  it("ตัดช่องว่าง # และแท็กซ้ำ", () => {
    expect(parseTags(" รักใส, #โรงเรียน ,รักใส,, Fantasy ")).toEqual(["รักใส", "โรงเรียน", "fantasy"]);
  });
  it("จำกัด 10 แท็กและความยาว", () => {
    expect(parseTags(Array.from({ length: 15 }, (_, i) => `t${i}`).join(","))).toHaveLength(10);
    expect(parseTags("ก".repeat(31))).toEqual([]);
  });
});

describe("เวลาไทย", () => {
  it("แปลงเวลาที่กรอกเป็นเวลาไทย", () => {
    expect(parseBangkokLocal("2026-11-28T20:00")?.toISOString()).toBe("2026-11-28T13:00:00.000Z");
    expect(parseBangkokLocal("bad")).toBeNull();
    expect(toBangkokLocal(new Date("2026-11-28T13:00:00Z"))).toBe("2026-11-28T20:00");
  });
});

describe("sniffImage", () => {
  it("ดูชนิดไฟล์จากเนื้อไฟล์", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe("jpg");
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))?.ext).toBe("png");
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(sniffImage(webp)?.ext).toBe("webp");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
  it("key ของปกต้องเป็นรูปแบบที่เราสร้างเท่านั้น", () => {
    expect(COVER_KEY_RE.test("12-0123456789abcdef.jpg")).toBe(true);
    expect(COVER_KEY_RE.test("../secret")).toBe(false);
  });
});

describe("parseNovelForm", () => {
  const form = (o: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  };
  it("อ่านค่าที่ถูกต้อง", () => {
    expect(
      parseNovelForm(form({ title: "  ฝน   แรก ", synopsis: "ย่อ", categoryId: "1", rating: "18+", tags: "a,b" }), [1]),
    ).toEqual({ value: { title: "ฝน แรก", synopsis: "ย่อ", categoryId: 1, rating: "18+", tags: ["a", "b"] } });
  });
  it("ปฏิเสธค่าที่ผิด", () => {
    expect(parseNovelForm(form({ title: "" }), [])).toHaveProperty("error");
    expect(parseNovelForm(form({ title: "x", categoryId: "9" }), [1])).toHaveProperty("error");
    expect(parseNovelForm(form({ title: "x", rating: "21+" }), [])).toHaveProperty("error");
  });
});
