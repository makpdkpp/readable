import type { ChapterStatus, NovelStatus, Rating } from "~/db/schema";
import { coverUrl } from "~/lib/novel/cover";

export const RATING_LABEL: Record<Rating, string> = { all: "ทั่วไป", "13+": "13+", "18+": "18+" };

export function RatingBadge({ rating }: { rating: Rating }) {
  if (rating === "all") return null;
  const cls =
    rating === "18+"
      ? "bg-red-600 text-white"
      : "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100";
  return <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${cls}`}>{rating}</span>;
}

const NOVEL_STATUS: Record<NovelStatus, [string, string]> = {
  draft: ["ร่าง ยังไม่เผยแพร่", "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300"],
  pending_review: ["รอ admin อนุมัติ", "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"],
  ongoing: ["เผยแพร่แล้ว ยังไม่จบ", "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"],
  completed: ["เผยแพร่แล้ว จบแล้ว", "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"],
  rejected: ["ไม่ผ่านการอนุมัติ", "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"],
  hidden: ["ถูก admin ซ่อน", "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"],
};

export function NovelStatusBadge({ status }: { status: NovelStatus }) {
  const [label, cls] = NOVEL_STATUS[status];
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

export function ChapterStatusBadge({ status, live }: { status: ChapterStatus; live: boolean }) {
  const [label, cls] = live
    ? ["เผยแพร่แล้ว", "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"]
    : status === "scheduled"
      ? ["ตั้งเวลาไว้", "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200"]
      : ["ร่าง", "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300"];
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

export function Cover({
  coverKey,
  title,
  className = "w-24",
}: {
  coverKey: string | null;
  title: string;
  className?: string;
}) {
  const src = coverUrl(coverKey);
  return (
    <div
      className={`${className} aspect-[2/3] shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-amber-200 to-rose-300 dark:from-amber-900 dark:to-rose-950`}
    >
      {src ? (
        <img src={src} alt={`ปก ${title}`} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full items-center justify-center p-2 text-center text-xs font-semibold text-stone-700 dark:text-stone-200">
          {title}
        </div>
      )}
    </div>
  );
}

export const inputClass =
  "mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500";

export const primaryButton =
  "rounded-md bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-60";

export const secondaryButton =
  "rounded-md border border-stone-300 dark:border-stone-700 px-4 py-2 font-semibold hover:bg-stone-50 dark:hover:bg-stone-900 disabled:opacity-60";

export const dangerButton =
  "rounded-md px-4 py-2 font-semibold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950 disabled:opacity-60";

export function Notice({ ok, error }: { ok?: string; error?: string }) {
  if (error)
    return (
      <p role="alert" className="rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">
        {error}
      </p>
    );
  if (ok)
    return (
      <p role="status" className="rounded-md bg-green-50 dark:bg-green-950 px-3 py-2 text-sm text-green-800 dark:text-green-200">
        {ok}
      </p>
    );
  return null;
}

export function AgeGateNotice({
  gate,
  redirectTo,
}: {
  gate: "login" | "birthdate" | "underage";
  redirectTo: string;
}) {
  return (
    <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-6 text-center space-y-3">
      <p className="text-lg font-semibold">เรื่องนี้สำหรับผู้ที่อายุ 18 ปีขึ้นไป</p>
      {gate === "login" && (
        <>
          <p className="text-sm">กรุณาเข้าสู่ระบบเพื่อยืนยันอายุ</p>
          <a href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`} className={`inline-block ${primaryButton}`}>
            เข้าสู่ระบบ
          </a>
        </>
      )}
      {gate === "birthdate" && (
        <>
          <p className="text-sm">กรุณากรอกวันเกิดในหน้าโปรไฟล์ก่อน</p>
          <a href="/profile" className={`inline-block ${primaryButton}`}>
            ไปที่โปรไฟล์
          </a>
        </>
      )}
      {gate === "underage" && <p className="text-sm">บัญชีของคุณยังอายุไม่ถึง 18 ปี จึงเปิดอ่านเรื่องนี้ไม่ได้</p>}
    </div>
  );
}

export function PreviewBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-sky-50 dark:bg-sky-950 px-3 py-2 text-sm text-sky-900 dark:text-sky-100">
      {children}
    </div>
  );
}
