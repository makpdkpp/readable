import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import type { JSONNode } from "~/lib/novel/content";

// ต้องตรงกับสิ่งที่ renderContentHtml รู้จัก ปิดส่วนที่ไม่ได้ใช้ในนิยาย
const extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    link: false,
  }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
];

function ToolbarButton({
  label,
  title,
  active,
  onClick,
}: {
  label: React.ReactNode;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      // กันไม่ให้ตัวแก้ไขเสีย focus ตอนกดปุ่ม ไม่งั้นรูปแบบที่เลือกไว้จะหาย
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`min-w-9 rounded px-2 py-1 text-sm ${
        active
          ? "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
          : "hover:bg-stone-100 dark:hover:bg-stone-800"
      }`}
    >
      {label}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      quote: e.isActive("blockquote"),
      center: e.isActive({ textAlign: "center" }),
      right: e.isActive({ textAlign: "right" }),
    }),
  });
  const c = () => editor.chain().focus();
  return (
    <div className="sticky top-0 z-10 flex flex-wrap gap-1 border-b border-stone-200 dark:border-stone-800 bg-white/95 dark:bg-gray-950/95 p-1 backdrop-blur">
      <ToolbarButton title="ตัวหนา" label={<b>B</b>} active={s.bold} onClick={() => c().toggleBold().run()} />
      <ToolbarButton title="ตัวเอียง" label={<i>I</i>} active={s.italic} onClick={() => c().toggleItalic().run()} />
      <ToolbarButton title="ขีดเส้นใต้" label={<u>U</u>} active={s.underline} onClick={() => c().toggleUnderline().run()} />
      <ToolbarButton title="ขีดฆ่า" label={<s>S</s>} active={s.strike} onClick={() => c().toggleStrike().run()} />
      <span className="mx-1 w-px bg-stone-200 dark:bg-stone-800" />
      <ToolbarButton title="หัวข้อใหญ่" label="H1" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()} />
      <ToolbarButton title="หัวข้อย่อย" label="H2" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()} />
      <ToolbarButton title="ข้อความอ้างอิง" label="❝" active={s.quote} onClick={() => c().toggleBlockquote().run()} />
      <ToolbarButton title="เส้นคั่นฉาก" label="―" onClick={() => c().setHorizontalRule().run()} />
      <span className="mx-1 w-px bg-stone-200 dark:bg-stone-800" />
      <ToolbarButton title="ชิดซ้าย" label="⯇" active={!s.center && !s.right} onClick={() => c().unsetTextAlign().run()} />
      <ToolbarButton title="กึ่งกลาง" label="≡" active={s.center} onClick={() => c().setTextAlign("center").run()} />
      <ToolbarButton title="ชิดขวา" label="⯈" active={s.right} onClick={() => c().setTextAlign("right").run()} />
    </div>
  );
}

/**
 * ตัวแก้ไขเนื้อหาตอน เขียน JSON ลง <input name="contentJson"> ทุกครั้งที่แก้
 * ฟอร์มจึงส่งเนื้อหาไปกับปุ่มบันทึกได้เลยโดยไม่ต้องมี API แยก
 */
export function ChapterEditor({
  initialContent,
  onChange,
}: {
  initialContent: JSONNode;
  onChange?: (json: string) => void;
}) {
  const editor = useEditor({
    extensions,
    content: initialContent as JSONContent,
    immediatelyRender: false, // render ฝั่ง server ไม่ได้ ต้องรอ browser
    editorProps: {
      attributes: {
        class: "chapter-content min-h-[60vh] px-4 py-6 focus:outline-none",
        "aria-label": "เนื้อหาตอน",
      },
    },
    onUpdate: ({ editor: e }) => onChange?.(JSON.stringify(e.getJSON())),
  });

  return (
    <div className="rounded-lg border border-stone-300 dark:border-stone-700">
      {editor ? (
        <>
          <Toolbar editor={editor} />
          <EditorContent editor={editor} />
        </>
      ) : (
        <div className="min-h-[60vh] px-4 py-6 text-stone-400">กำลังโหลดตัวแก้ไข...</div>
      )}
    </div>
  );
}
