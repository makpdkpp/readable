import type { ChapterStatus, NovelStatus, Rating } from "~/db/schema";
import { coverUrl } from "~/lib/novel/cover";

export const RATING_LABEL: Record<Rating, string> = { all: "ทั่วไป", "13+": "13+", "18+": "18+" };

export function RatingBadge({ rating }: { rating: Rating }) {
  if (rating === "all") return null;
  return <span className={`badge ${rating === "18+" ? "badge-18" : "badge-13"}`}>{rating}</span>;
}

const NOVEL_STATUS: Record<NovelStatus, [string, string]> = {
  draft: ["ร่าง ยังไม่เผยแพร่", "badge-neutral"],
  pending_review: ["รอ admin อนุมัติ", "badge-warn"],
  ongoing: ["เผยแพร่แล้ว ยังไม่จบ", "badge-ok"],
  completed: ["เผยแพร่แล้ว จบแล้ว", "badge-ok"],
  rejected: ["ไม่ผ่านการอนุมัติ", "badge-danger"],
  hidden: ["ถูก admin ซ่อน", "badge-danger"],
};

export function NovelStatusBadge({ status }: { status: NovelStatus }) {
  const [label, cls] = NOVEL_STATUS[status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function ChapterStatusBadge({ status, live }: { status: ChapterStatus; live: boolean }) {
  const [label, cls] = live
    ? ["เผยแพร่แล้ว", "badge-ok"]
    : status === "scheduled"
      ? ["ตั้งเวลาไว้", "badge-info"]
      : ["ร่าง", "badge-neutral"];
  return <span className={`badge ${cls}`}>{label}</span>;
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
      className={`cover ${className}`}
    >
      {src ? (
        <img src={src} alt={`ปก ${title}`} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full items-center justify-center p-2 text-center font-display text-sm font-semibold">
          {title}
        </div>
      )}
    </div>
  );
}

// หน้าตาของปุ่มและช่องกรอกอยู่ใน app.css แยกตามธีม
export const inputClass = "field-input";

export const primaryButton = "btn btn-primary";

export const secondaryButton = "btn btn-secondary";

export const dangerButton = "btn btn-danger";

export function Notice({ ok, error }: { ok?: string; error?: string }) {
  if (error)
    return (
      <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
        {error}
      </p>
    );
  if (ok)
    return (
      <p role="status" className="rounded-md bg-ok-soft px-3 py-2 text-sm text-ok">
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
    <div className="card bg-danger-soft p-6 text-center space-y-3">
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
    <div className="rounded-md bg-accent-soft px-3 py-2 text-sm text-ink">
      {children}
    </div>
  );
}
