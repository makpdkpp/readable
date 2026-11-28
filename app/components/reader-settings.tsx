import { useEffect, useState } from "react";

export type ReaderTheme = "auto" | "light" | "sepia" | "dark";
export type ReaderPrefs = { fontSize: number; lineHeight: number; theme: ReaderTheme };

const KEY = "rb_reader";
const DEFAULTS: ReaderPrefs = { fontSize: 19, lineHeight: 1.9, theme: "auto" };

export const THEME_STYLE: Record<ReaderTheme, React.CSSProperties> = {
  auto: {},
  light: { backgroundColor: "#ffffff", color: "#1c1917" },
  sepia: { backgroundColor: "#f6efe0", color: "#433422" },
  dark: { backgroundColor: "#111111", color: "#d6d3d1" },
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** การตั้งค่าหน้าอ่าน เก็บใน localStorage ของ browser ไม่ต้องล็อกอิน */
export function useReaderPrefs() {
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULTS);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<ReaderPrefs>;
      setPrefs((p) => ({ ...p, ...saved }));
    } catch {
      /* ค่าเสียก็ใช้ค่าเริ่มต้น */
    }
  }, []);
  const update = (patch: Partial<ReaderPrefs>) =>
    setPrefs((p) => {
      const next = {
        ...p,
        ...patch,
      };
      next.fontSize = clamp(next.fontSize, 14, 30);
      next.lineHeight = clamp(Math.round(next.lineHeight * 10) / 10, 1.4, 2.6);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  return [prefs, update] as const;
}

const THEMES: { value: ReaderTheme; label: string; swatch: string }[] = [
  { value: "auto", label: "ตามธีมเว็บ", swatch: "linear-gradient(135deg,var(--t-bg) 50%,var(--t-accent) 50%)" },
  { value: "light", label: "สว่าง", swatch: "#ffffff" },
  { value: "sepia", label: "ซีเปีย", swatch: "#f6efe0" },
  { value: "dark", label: "กลางคืน", swatch: "#111111" },
];

export function ReaderSettings({
  prefs,
  update,
}: {
  prefs: ReaderPrefs;
  update: (p: Partial<ReaderPrefs>) => void;
}) {
  const btn = "rounded-md border border-current/20 px-3 py-1 text-sm hover:bg-subtle";
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md border border-current/20 px-3 py-1 text-sm select-none">
        Aa ตั้งค่าการอ่าน
      </summary>
      <div
        className="absolute right-0 z-20 mt-2 w-64 space-y-4 card p-4 shadow-lg! text-ink"
        style={THEME_STYLE[prefs.theme]}
      >
        <div>
          <div className="mb-1 text-xs font-semibold">ขนาดตัวอักษร ({prefs.fontSize})</div>
          <div className="flex gap-2">
            <button type="button" className={btn} onClick={() => update({ fontSize: prefs.fontSize - 1 })}>
              ก-
            </button>
            <button type="button" className={btn} onClick={() => update({ fontSize: prefs.fontSize + 1 })}>
              ก+
            </button>
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold">ระยะบรรทัด ({prefs.lineHeight.toFixed(1)})</div>
          <div className="flex gap-2">
            <button type="button" className={btn} onClick={() => update({ lineHeight: prefs.lineHeight - 0.1 })}>
              แคบลง
            </button>
            <button type="button" className={btn} onClick={() => update({ lineHeight: prefs.lineHeight + 0.1 })}>
              ห่างขึ้น
            </button>
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold">สีพื้นหลัง</div>
          <div className="grid grid-cols-4 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => update({ theme: t.value })}
                aria-pressed={prefs.theme === t.value}
                className="flex flex-col items-center gap-1 text-xs"
              >
                <span
                  className={`h-8 w-8 rounded-full border ${prefs.theme === t.value ? "ring-2 ring-accent" : "border-line-strong"}`}
                  style={{ background: t.swatch }}
                />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}
