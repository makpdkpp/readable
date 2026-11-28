/**
 * เนื้อหาตอนเก็บเป็น JSON ของ Tiptap แล้วแปลงเป็น HTML ที่ฝั่ง server เอง
 * ไม่เชื่อ HTML จาก browser เลย: รู้จักเฉพาะ node/mark ที่อนุญาต ข้อความทุกตัวถูก escape
 * จึงไม่มีทางแทรก <script> หรือ attribute แปลกๆ เข้ามาในหน้าอ่านได้
 */

export type JSONNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
  content?: JSONNode[];
};

export const MAX_CONTENT_BYTES = 300_000;

const BLOCK_TAGS: Record<string, string> = {
  paragraph: "p",
  blockquote: "blockquote",
  bulletList: "ul",
  orderedList: "ol",
  listItem: "li",
};

// ลำดับคงที่ ทำให้ HTML ที่ได้เหมือนเดิมทุกครั้ง
const MARK_TAGS: [string, string][] = [
  ["bold", "strong"],
  ["italic", "em"],
  ["underline", "u"],
  ["strike", "s"],
];

const ALIGNS = new Set(["left", "center", "right", "justify"]);

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function alignAttr(node: JSONNode): string {
  const a = node.attrs?.textAlign;
  return typeof a === "string" && ALIGNS.has(a) && a !== "left" ? ` style="text-align:${a}"` : "";
}

function renderText(node: JSONNode): string {
  let html = escapeHtml(typeof node.text === "string" ? node.text : "");
  const marks = new Set((node.marks ?? []).map((m) => m?.type));
  for (const [mark, tag] of [...MARK_TAGS].reverse()) {
    if (marks.has(mark)) html = `<${tag}>${html}</${tag}>`;
  }
  return html;
}

function renderNodes(nodes: unknown, depth: number): string {
  if (!Array.isArray(nodes) || depth > 20) return "";
  return nodes.map((n) => renderNode(n as JSONNode, depth + 1)).join("");
}

function renderNode(node: JSONNode, depth: number): string {
  if (!node || typeof node !== "object") return "";
  switch (node.type) {
    case "text":
      return renderText(node);
    case "hardBreak":
      return "<br>";
    case "horizontalRule":
      return "<hr>";
    case "heading": {
      const level = node.attrs?.level === 3 ? 3 : 2;
      return `<h${level}${alignAttr(node)}>${renderNodes(node.content, depth)}</h${level}>`;
    }
    case "doc":
      return renderNodes(node.content, depth);
  }
  const tag = node.type ? BLOCK_TAGS[node.type] : undefined;
  if (tag) {
    const attr = tag === "p" ? alignAttr(node) : "";
    return `<${tag}${attr}>${renderNodes(node.content, depth)}</${tag}>`;
  }
  // node ที่ไม่รู้จัก: เก็บไว้แค่ข้อความข้างใน
  return renderNodes(node.content, depth);
}

export function renderContentHtml(doc: JSONNode): string {
  return renderNode(doc, 0);
}

export function plainText(node: JSONNode, depth = 0): string {
  if (!node || typeof node !== "object" || depth > 20) return "";
  if (node.type === "text") return typeof node.text === "string" ? node.text : "";
  if (!Array.isArray(node.content)) return "";
  const sep = node.type === "doc" || node.type?.endsWith("List") ? "\n" : "";
  return node.content.map((c) => plainText(c, depth + 1)).join(sep);
}

/** นับคำ ภาษาไทยไม่มีช่องว่าง จึงใช้ Intl.Segmenter ตัดคำ */
export function countWords(text: string): number {
  let n = 0;
  for (const seg of new Intl.Segmenter("th", { granularity: "word" }).segment(text)) {
    if (seg.isWordLike) n++;
  }
  return n;
}

export const EMPTY_DOC: JSONNode = { type: "doc", content: [{ type: "paragraph" }] };

/** แปลงข้อความ JSON จากฟอร์ม คืน null ถ้าไม่ใช่เอกสาร Tiptap หรือใหญ่เกินไป */
export function parseContent(raw: string): JSONNode | null {
  if (new TextEncoder().encode(raw).length > MAX_CONTENT_BYTES) return null;
  try {
    const doc = JSON.parse(raw) as JSONNode;
    if (!doc || doc.type !== "doc") return null;
    return doc;
  } catch {
    return null;
  }
}
