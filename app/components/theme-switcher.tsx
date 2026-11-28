import { useEffect, useRef, useState } from "react";
import { useFetcher, useFetchers, useLocation, useRouteLoaderData } from "react-router";

import { DEFAULT_THEME, THEME_LIST, isThemeId, type ThemeId, type ThemeInfo } from "~/lib/theme";

/** ธีมที่กำลังใช้ ถ้ากำลังส่งคำขอเปลี่ยนธีมอยู่จะใช้ธีมใหม่ทันที ไม่ต้องรอ server */
export function useActiveTheme(): ThemeId {
  const data = useRouteLoaderData("root") as { theme?: ThemeId } | undefined;
  const pending = useFetchers()
    .map((f) => (f.formAction === "/theme" ? f.formData?.get("theme") : null))
    .find(isThemeId);
  return pending ?? data?.theme ?? DEFAULT_THEME;
}

function Swatch({ theme, size = "h-6 w-6" }: { theme: ThemeInfo; size?: string }) {
  const [bg, ink, accent] = theme.swatch;
  return (
    <span
      aria-hidden="true"
      className={`${size} inline-block shrink-0 rounded-full border border-line-strong`}
      style={{ background: `conic-gradient(${accent} 0 33%, ${ink} 0 50%, ${bg} 0)` }}
    />
  );
}

function ThemeForm({
  theme,
  active,
  children,
  className,
  onPicked,
}: {
  theme: ThemeInfo;
  active: boolean;
  children: React.ReactNode;
  className: string;
  onPicked?: () => void;
}) {
  const fetcher = useFetcher();
  const location = useLocation();
  // ส่ง js=1 เฉพาะตอน JavaScript ทำงานแล้ว ถ้าไม่มี JS ฟอร์มจะ redirect กลับหน้าเดิมตามปกติ
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return (
    <fetcher.Form method="post" action="/theme" onSubmit={onPicked}>
      <input type="hidden" name="theme" value={theme.id} />
      <input type="hidden" name="redirectTo" value={location.pathname + location.search} />
      {hydrated && <input type="hidden" name="js" value="1" />}
      <button type="submit" aria-pressed={active} className={className}>
        {children}
      </button>
    </fetcher.Form>
  );
}

/** ปุ่มเลือกธีมบนแถบด้านบน */
export function ThemeSwitcher() {
  const active = useActiveTheme();
  const ref = useRef<HTMLDetailsElement>(null);
  const current = THEME_LIST.find((t) => t.id === active)!;
  return (
    <details ref={ref} className="relative">
      <summary
        className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full px-2 text-sm select-none hover:bg-subtle"
        aria-label={`เปลี่ยนธีม ตอนนี้ใช้ ${current.name}`}
      >
        <Swatch theme={current} />
        <span className="hidden sm:inline">ธีม</span>
      </summary>
      <div className="card fixed inset-x-4 top-16 z-40 p-2 shadow-lg sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-72">
        <p className="px-2 pt-1 pb-2 text-xs text-muted">เลือกหน้าตาของเว็บ เปลี่ยนได้ตลอด</p>
        {THEME_LIST.map((t) => (
          <ThemeForm
            key={t.id}
            theme={t}
            active={t.id === active}
            onPicked={() => ref.current?.removeAttribute("open")}
            className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-subtle ${
              t.id === active ? "bg-accent-soft" : ""
            }`}
          >
            <Swatch theme={t} size="h-8 w-8" />
            <span className="min-w-0">
              <span className="block font-semibold">{t.name}</span>
              <span className="block text-xs text-muted">{t.description}</span>
            </span>
          </ThemeForm>
        ))}
      </div>
    </details>
  );
}

/** ตัวเลือกธีมแบบการ์ดใหญ่ ใช้ในหน้าโปรไฟล์ */
export function ThemePicker() {
  const active = useActiveTheme();
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {THEME_LIST.map((t) => {
        const [bg, ink, accent] = t.swatch;
        return (
          <ThemeForm
            key={t.id}
            theme={t}
            active={t.id === active}
            className={`w-full overflow-hidden rounded-xl border-2 text-left ${
              t.id === active ? "border-accent" : "border-line"
            }`}
          >
            <span className="block h-16 p-3" style={{ background: bg, color: ink }}>
              <span className="block text-lg font-bold leading-none">ก</span>
              <span className="mt-2 block h-2 w-10 rounded-full" style={{ background: accent }} />
            </span>
            <span className="block p-3">
              <span className="block font-semibold">{t.name}</span>
              <span className="block text-xs text-muted">{t.description}</span>
              {t.id === active && <span className="mt-1 block text-xs font-semibold text-accent">กำลังใช้อยู่</span>}
            </span>
          </ThemeForm>
        );
      })}
    </div>
  );
}
