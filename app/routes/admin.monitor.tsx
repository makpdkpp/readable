import { env } from "cloudflare:workers";
import { Link } from "react-router";

import type { Route } from "./+types/admin.monitor";
import { AdminTabs } from "~/components/admin-ui";
import { requireUser } from "~/lib/auth/session.server";
import { getAppStats, pingD1 } from "~/lib/monitor/app-stats.server";
import { analyticsConfigured, getCloudflareUsage } from "~/lib/monitor/cloudflare.server";
import {
  D1_STORAGE_INCLUDED_GB,
  FREE_CPU_MS_PER_REQUEST,
  FREE_DAILY,
  type CostEstimate,
  type Level,
  estimateMonthlyCost,
  parsePlan,
  percentOf,
  usageLevel,
} from "~/lib/monitor/pricing";
import { summarizeUsage } from "~/lib/monitor/summary";
import { requireAdmin } from "~/lib/novel/access.server";
import { formatThaiDateTime } from "~/lib/novel/time";

// อัตราแลกเปลี่ยนคร่าว ๆ ไว้แสดงเป็นบาท Cloudflare เก็บเงินเป็น USD
const USD_THB = 33;

export function meta({}: Route.MetaArgs) {
  return [{ title: "ติดตามระบบ — readable" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  requireAdmin(await requireUser(request));
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";
  const now = new Date();
  const [ping, app, usage] = await Promise.all([
    pingD1(),
    getAppStats(now),
    getCloudflareUsage(refresh).catch((e: unknown) => {
      console.error("cloudflare analytics", e);
      return null;
    }),
  ]);
  const plan = parsePlan(env.CF_PLAN);
  const summary = summarizeUsage(usage, ping.sizeBytes, now);
  return {
    configured: analyticsConfigured(),
    plan,
    ping,
    app,
    usage,
    summary,
    cost: {
      current: estimateMonthlyCost(summary.monthly, plan),
      free: estimateMonthlyCost(summary.monthly, "free"),
      paid: estimateMonthlyCost(summary.monthly, "paid"),
    },
  };
}

const num = (n: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(n);
const dec = (n: number, d = 1) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: d }).format(n);
const usd = (n: number) => `$${n.toFixed(2)}`;
const thb = (n: number) => `≈ ฿${num(n * USD_THB)}`;
function bytes(b: number | null) {
  if (b === null) return "—";
  // ใช้หน่วยฐาน 1000 แบบเดียวกับที่ Cloudflare คิดเงิน
  if (b < 1e3) return `${b} B`;
  if (b < 1e6) return `${dec(b / 1e3)} KB`;
  if (b < 1e9) return `${dec(b / 1e6)} MB`;
  return `${dec(b / 1e9, 2)} GB`;
}

const LEVEL_TEXT: Record<Level, string> = { ok: "ปกติ", warn: "ใกล้เต็ม", danger: "เกินโควตา" };
const LEVEL_BAR: Record<Level, string> = { ok: "bg-ok", warn: "bg-warn", danger: "bg-danger" };
const LEVEL_BADGE: Record<Level, string> = { ok: "badge-ok", warn: "badge-warn", danger: "badge-danger" };

export default function AdminMonitor({ loaderData }: Route.ComponentProps) {
  const { configured, plan, ping, app, usage, summary, cost } = loaderData;
  const errorRate =
    summary.today.workerRequests && summary.today.workerErrors !== null
      ? (summary.today.workerErrors / summary.today.workerRequests) * 100
      : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      <AdminTabs />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">ติดตามระบบและค่าใช้จ่าย</h1>
          <p className="text-sm text-muted">
            แผน Cloudflare: <strong>{plan === "paid" ? "Workers Paid" : "Workers Free"}</strong>
            {usage && <> · ข้อมูล Cloudflare ณ {formatThaiDateTime(usage.fetchedAt)} (เก็บไว้ 5 นาที)</>}
          </p>
        </div>
        {configured && (
          <Link to="/admin/monitor?refresh=1" className="btn btn-secondary">
            ดึงข้อมูลใหม่
          </Link>
        )}
      </div>

      {/* สถานะตอนนี้ */}
      <section className="space-y-3" aria-labelledby="h-health">
        <h2 id="h-health" className="text-lg font-semibold">สถานะตอนนี้</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile
            label="ฐานข้อมูล D1"
            value={ping.error ? "ล่ม" : `${ping.ms} ms`}
            hint={ping.error ?? "เวลาตอบ query ทดสอบ"}
            level={ping.error ? "danger" : ping.ms > 500 ? "warn" : "ok"}
          />
          <Tile
            label="Requests วันนี้"
            value={summary.today.workerRequests === null ? "—" : num(summary.today.workerRequests)}
            hint="นับตั้งแต่ 07:00 น. (เที่ยงคืน UTC)"
          />
          <Tile
            label="Error วันนี้"
            value={summary.today.workerErrors === null ? "—" : num(summary.today.workerErrors)}
            hint={errorRate === null ? "ยังไม่มีข้อมูล" : `${dec(errorRate, 2)}% ของ requests`}
            level={errorRate === null ? undefined : errorRate >= 5 ? "danger" : errorRate >= 1 ? "warn" : "ok"}
          />
          <Tile
            label="CPU ต่อ request (p99)"
            value={summary.today.cpuP99Ms === null ? "—" : `${dec(summary.today.cpuP99Ms)} ms`}
            hint={plan === "free" ? `แผนฟรีจำกัด ${FREE_CPU_MS_PER_REQUEST} ms` : "ช้าสุด 1% ของวันนี้"}
            level={
              summary.today.cpuP99Ms === null || plan === "paid"
                ? undefined
                : usageLevel(percentOf(summary.today.cpuP99Ms, FREE_CPU_MS_PER_REQUEST))
            }
          />
        </div>
      </section>

      {!configured && <SetupGuide />}
      {usage && <SectionErrors usage={usage} />}

      {/* โควตา */}
      {configured && (
        <section className="space-y-3" aria-labelledby="h-quota">
          <h2 id="h-quota" className="text-lg font-semibold">
            {plan === "free" ? "โควตาฟรีรายวัน (วันนี้)" : "ปริมาณการใช้วันนี้"}
          </h2>
          {plan === "free" && (
            <p className="text-sm text-muted">
              แผนฟรีไม่เสียเงิน แต่ถ้าใช้เกินโควตาในวันนั้น เว็บหรือฐานข้อมูลจะใช้ไม่ได้จนถึง 07:00 น. ของวันถัดไป
            </p>
          )}
          <div className="card space-y-4 p-4">
            <QuotaBar
              label="Workers requests"
              value={summary.today.workerRequests}
              limit={FREE_DAILY.workerRequests}
              peak={summary.peakDailyPct.workerRequests}
            />
            <QuotaBar
              label="D1 rows read"
              value={summary.today.d1RowsRead}
              limit={FREE_DAILY.d1RowsRead}
              peak={summary.peakDailyPct.d1RowsRead}
            />
            <QuotaBar
              label="D1 rows written"
              value={summary.today.d1RowsWritten}
              limit={FREE_DAILY.d1RowsWritten}
              peak={summary.peakDailyPct.d1RowsWritten}
            />
            <QuotaBar
              label="D1 storage (รวม)"
              value={ping.sizeBytes}
              limit={D1_STORAGE_INCLUDED_GB * 1e9}
              format={bytes}
            />
          </div>
        </section>
      )}

      {/* ค่าใช้จ่าย */}
      {configured && (
        <CostSection current={cost.current} free={cost.free} paid={cost.paid} plan={plan} days={summary.period.days} />
      )}

      {/* กราฟ */}
      {usage?.workers.ok && usage.workers.data.days.length > 0 && (
        <section className="space-y-3" aria-labelledby="h-traffic">
          <h2 id="h-traffic" className="text-lg font-semibold">Requests รายวัน (30 วัน)</h2>
          <p className="text-sm text-muted">
            รวม {num(summary.period.workerRequests)} requests · error {num(summary.period.workerErrors)} ครั้ง ·
            วันตามเวลา UTC
          </p>
          <BarChart
            label="Requests รายวัน"
            points={usage.workers.data.days.map((d) => ({
              key: d.date,
              value: d.requests,
              tip: `${d.date}: ${num(d.requests)} requests, error ${num(d.errors)}, CPU p50 ${dec(d.cpuP50Ms)} ms`,
            }))}
            limit={plan === "free" ? FREE_DAILY.workerRequests : undefined}
          />
          <details className="text-sm">
            <summary className="cursor-pointer text-accent">ดูเป็นตาราง</summary>
            <table className="mt-2 w-full text-left">
              <thead className="text-muted">
                <tr>
                  <th className="py-1">วันที่</th>
                  <th className="py-1 text-right">Requests</th>
                  <th className="py-1 text-right">Errors</th>
                  <th className="py-1 text-right">CPU p50</th>
                  <th className="py-1 text-right">CPU p99</th>
                </tr>
              </thead>
              <tbody>
                {usage.workers.data.days.map((d) => (
                  <tr key={d.date} className="border-t border-line">
                    <td className="py-1">{d.date}</td>
                    <td className="py-1 text-right tabular-nums">{num(d.requests)}</td>
                    <td className="py-1 text-right tabular-nums">{num(d.errors)}</td>
                    <td className="py-1 text-right tabular-nums">{dec(d.cpuP50Ms)} ms</td>
                    <td className="py-1 text-right tabular-nums">{dec(d.cpuP99Ms)} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          {usage.workers.data.statuses.length > 0 && (
            <p className="text-sm text-muted">
              ผลการทำงาน 30 วัน:{" "}
              {usage.workers.data.statuses.map((s) => `${STATUS_LABEL[s.status] ?? s.status} ${num(s.requests)}`).join(" · ")}
            </p>
          )}
        </section>
      )}

      {/* สถิติเว็บ */}
      <section className="space-y-3" aria-labelledby="h-app">
        <h2 id="h-app" className="text-lg font-semibold">กิจกรรมบนเว็บ</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="สมาชิกทั้งหมด" value={num(app.users.total)} hint={`ใหม่ 7 วัน ${num(app.users.new7d)} · 30 วัน ${num(app.users.new30d)}`} />
          <Tile label="ล็อกอินค้างอยู่" value={num(app.users.activeSessions)} hint="คนที่ session ยังไม่หมดอายุ" />
          <Tile label="คนอ่าน 24 ชม." value={num(app.readers.d1)} hint={`7 วัน ${num(app.readers.d7)} คน (เฉพาะที่ล็อกอิน)`} />
          <Tile
            label="รออนุมัติ 18+"
            value={num(app.novels.pendingReview)}
            hint={app.novels.pendingReview > 0 ? "ไปที่แท็บอนุมัติ 18+" : "ไม่มีงานค้าง"}
            level={app.novels.pendingReview > 0 ? "warn" : undefined}
          />
          <Tile label="เรื่องที่เผยแพร่" value={num(app.novels.published)} hint={`ร่าง ${num(app.novels.draft)} · ซ่อน ${num(app.novels.hidden)}`} />
          <Tile label="ตอนที่เผยแพร่" value={num(app.chapters.published)} hint={`ใหม่ 7 วัน ${num(app.chapters.new7d)} ตอน`} />
          <Tile label="จำนวนคำรวม" value={num(app.chapters.words)} hint="เฉพาะตอนที่เผยแพร่" />
          <Tile
            label="คอมเมนต์ 7 วัน"
            value={num(app.community.comments7d)}
            hint={`ไลก์ ${num(app.community.likes7d)} · ถูกซ่อนทั้งหมด ${num(app.community.commentsHidden)}`}
          />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">สมัครใหม่รายวัน (14 วัน เวลาไทย)</h3>
          <BarChart
            label="สมัครใหม่รายวัน"
            points={app.signups.map((d) => ({ key: d.day, value: d.n, tip: `${d.day}: สมัคร ${num(d.n)} คน` }))}
            height={80}
          />
        </div>
        {usage?.r2.ok && (
          <p className="text-sm text-muted">
            รูปปกใน R2: {usage.r2.data.objectCount === null ? "—" : num(usage.r2.data.objectCount)} ไฟล์ ·{" "}
            {bytes(usage.r2.data.storageBytes)} · 30 วันที่ผ่านมา Class A {num(usage.r2.data.classA)} ครั้ง, Class B{" "}
            {num(usage.r2.data.classB)} ครั้ง
          </p>
        )}
      </section>

      <p className="text-sm text-muted">
        ดู log และ error ละเอียดได้ที่ Cloudflare dashboard → Workers &amp; Pages → readable → Observability
      </p>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  success: "สำเร็จ",
  clientDisconnected: "ผู้ใช้ปิดก่อนโหลดเสร็จ",
  scriptThrewException: "โค้ดพัง",
  exceededResources: "เกินโควตา CPU/หน่วยความจำ",
  internalError: "Cloudflare ขัดข้อง",
};

function Tile({ label, value, hint, level }: { label: string; value: string; hint?: string; level?: Level }) {
  return (
    <div className="card p-3">
      <p className="flex items-center justify-between gap-2 text-sm text-muted">
        <span>{label}</span>
        {level && <span className={`badge ${LEVEL_BADGE[level]}`}>{LEVEL_TEXT[level]}</span>}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function QuotaBar({
  label,
  value,
  limit,
  peak,
  format = num,
}: {
  label: string;
  value: number | null;
  limit: number;
  peak?: number;
  format?: (n: number) => string;
}) {
  const pct = value === null ? 0 : percentOf(value, limit);
  const level = usageLevel(pct);
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums text-muted">
          {value === null ? "ไม่มีข้อมูล" : `${format(value)} / ${format(limit)} (${dec(pct)}%)`}{" "}
          {value !== null && <span className={`badge ${LEVEL_BADGE[level]}`}>{LEVEL_TEXT[level]}</span>}
        </span>
      </div>
      <div
        className="mt-1 h-2 overflow-hidden rounded-full bg-subtle"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(pct, 100))}
      >
        <div className={`h-full rounded-full ${LEVEL_BAR[level]}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {peak !== undefined && peak > 0 && (
        <p className="mt-1 text-xs text-muted">วันที่ใช้มากสุดใน 30 วัน: {dec(peak)}% ของโควตา</p>
      )}
    </div>
  );
}

function CostSection({
  current,
  free,
  paid,
  plan,
  days,
}: {
  current: CostEstimate;
  free: CostEstimate;
  paid: CostEstimate;
  plan: "free" | "paid";
  days: number;
}) {
  return (
    <section className="space-y-3" aria-labelledby="h-cost">
      <h2 id="h-cost" className="text-lg font-semibold">ค่าใช้จ่ายโดยประมาณต่อเดือน</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-sm text-muted">แผนที่ใช้อยู่ ({plan === "paid" ? "Paid" : "Free"})</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{usd(current.total)}</p>
          <p className="text-sm text-muted">{thb(current.total)} ต่อเดือน</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-muted">{plan === "paid" ? "ถ้ากลับไปแผน Free" : "ถ้าอัปเกรดเป็น Workers Paid"}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{usd(plan === "paid" ? free.total : paid.total)}</p>
          <p className="text-sm text-muted">
            {thb(plan === "paid" ? free.total : paid.total)} ต่อเดือน
            {plan === "free" && " (ขั้นต่ำ $5 ไม่มีโควตารายวัน)"}
          </p>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-3 py-2">รายการ</th>
              <th className="px-3 py-2 text-right">ประมาณต่อเดือน</th>
              <th className="px-3 py-2 text-right">ฟรี/รวมในแผน</th>
              <th className="px-3 py-2 text-right">ค่าใช้จ่าย</th>
            </tr>
          </thead>
          <tbody>
            {current.base > 0 && (
              <tr className="border-t border-line">
                <td className="px-3 py-2">ค่าแผน Workers Paid</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right tabular-nums">{usd(current.base)}</td>
              </tr>
            )}
            {current.lines.map((l) => (
              <tr key={l.key} className="border-t border-line">
                <td className="px-3 py-2">{l.label}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {l.unit === "GB" || l.unit === "GB-เดือน"
                    ? `${l.usage > 0 && l.usage < 0.001 ? "< 0.001" : dec(l.usage, 3)} ${l.unit}`
                    : `${num(l.usage)} ${l.unit}`}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted">
                  {l.included === null ? "โควตารายวัน" : `${num(l.included)}`}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{usd(l.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        ประมาณจากค่าเฉลี่ยรายวัน{days > 0 ? ` ${num(days)} วันล่าสุด` : ""} คูณ 30 วัน · CPU time ประมาณจาก requests × CPU กลาง (p50)
        · R2 คิดเงินแยกจากแผน Workers จึงอาจเสียเงินได้แม้อยู่แผน Free ถ้าเกินโควตาฟรีรายเดือน · ราคาตามหน้า Cloudflare
        เมื่อ 28 พ.ย. 2026 · เงินบาทคิดที่ 1 USD ≈ {USD_THB} บาท
      </p>
    </section>
  );
}

/** กราฟแท่งชุดเดียว ใช้สีเน้นของธีม เอาเมาส์ชี้/แตะแต่ละแท่งเพื่อดูตัวเลข */
function BarChart({
  label,
  points,
  height = 140,
  limit,
}: {
  label: string;
  points: { key: string; value: number; tip: string }[];
  height?: number;
  limit?: number;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const top = max * 1.1;
  // แสดงเส้นโควตาเฉพาะตอนที่ใช้ไปเกิน 20% ไม่งั้นแท่งจะเตี้ยจนอ่านไม่ออก
  const showLimit = limit !== undefined && max >= limit * 0.2;
  const scale = showLimit ? Math.max(top, limit * 1.05) : top;
  return (
    <figure className="card p-3">
      <div className="relative flex items-end gap-[2px]" style={{ height }} role="img" aria-label={`${label} สูงสุด ${num(max)}`}>
        {showLimit && (
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-danger"
            style={{ bottom: `${(limit / scale) * 100}%` }}
          >
            <span className="absolute right-0 -top-5 text-xs text-danger">โควตาฟรี {num(limit)}</span>
          </div>
        )}
        {points.map((p) => (
          <div key={p.key} className="group relative flex h-full flex-1 items-end" title={p.tip}>
            <div
              className="w-full rounded-t-[4px] bg-accent opacity-85 group-hover:opacity-100"
              style={{ height: p.value > 0 ? `max(2px, ${(p.value / scale) * 100}%)` : 0 }}
            />
          </div>
        ))}
      </div>
      <figcaption className="mt-1 flex justify-between text-xs text-muted">
        <span>{points[0]?.key.slice(5)}</span>
        <span>สูงสุด {num(max)}</span>
        <span>{points.at(-1)?.key.slice(5)}</span>
      </figcaption>
    </figure>
  );
}

function SectionErrors({ usage }: { usage: NonNullable<Route.ComponentProps["loaderData"]["usage"]> }) {
  const errs = [
    ["Workers", usage.workers],
    ["D1", usage.d1],
    ["R2", usage.r2],
  ].filter(([, s]) => !(s as { ok: boolean }).ok) as [string, { ok: false; error: string }][];
  if (errs.length === 0) return null;
  return (
    <div role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
      ดึงข้อมูลจาก Cloudflare ไม่สำเร็จบางส่วน:
      <ul className="list-disc pl-5">
        {errs.map(([name, s]) => (
          <li key={name}>
            {name}: {s.error}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SetupGuide() {
  return (
    <section className="card space-y-2 p-4 text-sm" aria-labelledby="h-setup">
      <h2 id="h-setup" className="text-lg font-semibold">เปิดการดึงข้อมูลจาก Cloudflare</h2>
      <p className="text-muted">
        ตอนนี้แสดงเฉพาะข้อมูลจากฐานข้อมูลของเว็บ ถ้าจะดู requests, error, โควตา และค่าใช้จ่าย ต้องตั้งค่า 2 ตัว
      </p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Cloudflare dashboard → รูปโปรไฟล์ขวาบน → My Profile → API Tokens → Create Token → Create Custom Token
        </li>
        <li>
          ตั้งชื่อ เช่น <code>readable-analytics</code> · Permissions เลือก <strong>Account → Account Analytics → Read</strong>{" "}
          อย่างเดียว · Account Resources เลือกบัญชีของคุณ → Continue → Create Token แล้วคัดลอก token
        </li>
        <li>
          Workers &amp; Pages → readable → Settings → Variables and Secrets → Add → ชนิด <strong>Secret</strong> ชื่อ{" "}
          <code>CF_ANALYTICS_TOKEN</code> ใส่ token
        </li>
        <li>
          Add อีกตัว ชนิด Text ชื่อ <code>CF_ACCOUNT_ID</code> ใส่ Account ID (หน้า Workers &amp; Pages ด้านขวา หรือเลขยาวใน URL
          ของ dashboard)
        </li>
        <li>ถ้าอัปเกรดเป็น Workers Paid ให้เพิ่ม Text ชื่อ <code>CF_PLAN</code> ค่า <code>paid</code></li>
      </ol>
    </section>
  );
}
