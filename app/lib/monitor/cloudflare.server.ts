import { env } from "cloudflare:workers";

import { r2OperationClass } from "./pricing";

/**
 * ดึงสถิติการใช้งานจาก Cloudflare GraphQL Analytics API
 * ต้องตั้ง secret CF_ANALYTICS_TOKEN (สิทธิ์ Account Analytics: Read) และ CF_ACCOUNT_ID
 * ผลลัพธ์ cache ไว้ 5 นาที กันชนโควตา API (300 query ต่อ 5 นาที)
 */

// ค่าตรงกับ wrangler.jsonc ถ้าเปลี่ยนชื่อ worker, database หรือ bucket ต้องแก้ที่นี่ด้วย
export const WORKER_NAME = "readable";
export const D1_DATABASE_ID = "cb69a134-f6c5-4b62-8796-ec8877176fa8";
export const R2_BUCKET = "readable-covers";

const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";
const CACHE_SECONDS = 300;
const DAYS = 30;

export type DayPoint = {
  date: string; // YYYY-MM-DD (UTC)
  requests: number;
  errors: number;
  subrequests: number;
  cpuP50Ms: number;
  cpuP99Ms: number;
};

export type D1Day = {
  date: string;
  readQueries: number;
  writeQueries: number;
  rowsRead: number;
  rowsWritten: number;
  p90Ms: number;
};

export type Section<T> = { ok: true; data: T } | { ok: false; error: string };

export type CloudflareUsage = {
  fetchedAt: string;
  rangeStart: string;
  workers: Section<{ days: DayPoint[]; statuses: { status: string; requests: number }[] }>;
  d1: Section<{ days: D1Day[] }>;
  r2: Section<{
    classA: number;
    classB: number;
    byAction: { action: string; requests: number; cls: "A" | "B" | "free" }[];
    objectCount: number | null;
    storageBytes: number | null;
  }>;
};

export function analyticsConfigured(): boolean {
  return Boolean(env.CF_ANALYTICS_TOKEN && env.CF_ACCOUNT_ID);
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 401 || res.status === 403) throw new Error("token ไม่ถูกต้องหรือไม่มีสิทธิ์ Account Analytics: Read");
  if (!res.ok) throw new Error(`Cloudflare API ตอบ ${res.status}`);
  const body = (await res.json()) as { data?: { viewer?: { accounts?: T[] } }; errors?: { message: string }[] | null };
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "));
  const account = body.data?.viewer?.accounts?.[0];
  if (!account) throw new Error("ไม่พบบัญชี ตรวจ CF_ACCOUNT_ID ว่าตรงกับบัญชีของ token");
  return account;
}

async function section<T>(fn: () => Promise<T>): Promise<Section<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const WORKERS_QUERY = `query ($account: String!, $script: String!, $start: Time!, $end: Time!) {
  viewer { accounts(filter: { accountTag: $account }) {
    daily: workersInvocationsAdaptive(limit: 100, orderBy: [date_ASC],
      filter: { scriptName: $script, datetime_geq: $start, datetime_leq: $end }) {
      sum { requests errors subrequests }
      quantiles { cpuTimeP50 cpuTimeP99 }
      dimensions { date }
    }
    statuses: workersInvocationsAdaptive(limit: 20,
      filter: { scriptName: $script, datetime_geq: $start, datetime_leq: $end }) {
      sum { requests }
      dimensions { status }
    }
  } }
}`;

const D1_QUERY = `query ($account: String!, $db: String!, $start: Date!, $end: Date!) {
  viewer { accounts(filter: { accountTag: $account }) {
    d1AnalyticsAdaptiveGroups(limit: 100, orderBy: [date_ASC],
      filter: { databaseId: $db, date_geq: $start, date_leq: $end }) {
      sum { readQueries writeQueries rowsRead rowsWritten }
      quantiles { queryBatchTimeMsP90 }
      dimensions { date }
    }
  } }
}`;

const R2_QUERY = `query ($account: String!, $bucket: String!, $start: Time!, $end: Time!) {
  viewer { accounts(filter: { accountTag: $account }) {
    ops: r2OperationsAdaptiveGroups(limit: 100,
      filter: { bucketName: $bucket, datetime_geq: $start, datetime_leq: $end }) {
      sum { requests }
      dimensions { actionType }
    }
    storage: r2StorageAdaptiveGroups(limit: 1, orderBy: [datetime_DESC],
      filter: { bucketName: $bucket, datetime_geq: $start, datetime_leq: $end }) {
      max { objectCount payloadSize metadataSize }
      dimensions { datetime }
    }
  } }
}`;

type WorkersRow = {
  sum: { requests: number; errors: number; subrequests: number };
  quantiles: { cpuTimeP50: number; cpuTimeP99: number };
  dimensions: { date: string };
};

/** ช่วงเวลา: ตั้งแต่เที่ยงคืน UTC ของ 29 วันก่อน ถึงตอนนี้ (รวมวันนี้ = 30 วัน) */
export function usageRange(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (DAYS - 1)));
  return { start, end: now };
}

async function fetchUsage(now: Date): Promise<CloudflareUsage> {
  const account = env.CF_ACCOUNT_ID!.trim();
  const { start, end } = usageRange(now);
  const t = { start: start.toISOString(), end: end.toISOString() };
  const d = { start: t.start.slice(0, 10), end: t.end.slice(0, 10) };

  const [workers, d1, r2] = await Promise.all([
    section(async () => {
      const a = await gql<{ daily: WorkersRow[]; statuses: { sum: { requests: number }; dimensions: { status: string } }[] }>(
        WORKERS_QUERY,
        { account, script: WORKER_NAME, ...t },
      );
      return {
        days: a.daily.map((r) => ({
          date: r.dimensions.date,
          requests: r.sum.requests,
          errors: r.sum.errors,
          subrequests: r.sum.subrequests,
          // Cloudflare ส่ง CPU time เป็นไมโครวินาที
          cpuP50Ms: r.quantiles.cpuTimeP50 / 1000,
          cpuP99Ms: r.quantiles.cpuTimeP99 / 1000,
        })),
        statuses: a.statuses
          .map((s) => ({ status: s.dimensions.status, requests: s.sum.requests }))
          .sort((x, y) => y.requests - x.requests),
      };
    }),
    section(async () => {
      const a = await gql<{
        d1AnalyticsAdaptiveGroups: {
          sum: { readQueries: number; writeQueries: number; rowsRead: number; rowsWritten: number };
          quantiles: { queryBatchTimeMsP90: number };
          dimensions: { date: string };
        }[];
      }>(D1_QUERY, { account, db: D1_DATABASE_ID, ...d });
      return {
        days: a.d1AnalyticsAdaptiveGroups.map((r) => ({
          date: r.dimensions.date,
          ...r.sum,
          p90Ms: r.quantiles.queryBatchTimeMsP90,
        })),
      };
    }),
    section(async () => {
      const a = await gql<{
        ops: { sum: { requests: number }; dimensions: { actionType: string } }[];
        storage: { max: { objectCount: number; payloadSize: number; metadataSize: number } }[];
      }>(R2_QUERY, { account, bucket: R2_BUCKET, ...t });
      const byAction = a.ops
        .map((o) => ({ action: o.dimensions.actionType, requests: o.sum.requests, cls: r2OperationClass(o.dimensions.actionType) }))
        .sort((x, y) => y.requests - x.requests);
      const sumOf = (cls: "A" | "B") => byAction.filter((o) => o.cls === cls).reduce((s, o) => s + o.requests, 0);
      const st = a.storage[0]?.max;
      return {
        classA: sumOf("A"),
        classB: sumOf("B"),
        byAction,
        objectCount: st ? st.objectCount : null,
        storageBytes: st ? st.payloadSize + st.metadataSize : null,
      };
    }),
  ]);

  return { fetchedAt: now.toISOString(), rangeStart: t.start, workers, d1, r2 };
}

const cacheKey = () => new Request(`https://monitor.internal/cloudflare-usage/${env.CF_ACCOUNT_ID}`);

function cacheStore(): Cache | null {
  try {
    return typeof caches !== "undefined" ? (caches as unknown as { default: Cache }).default ?? null : null;
  } catch {
    return null;
  }
}

/** ดึงสถิติ ใช้ cache 5 นาที ถ้า refresh = true จะดึงใหม่ */
export async function getCloudflareUsage(refresh = false): Promise<CloudflareUsage | null> {
  if (!analyticsConfigured()) return null;
  const cache = cacheStore();
  if (cache && !refresh) {
    const hit = await cache.match(cacheKey()).catch(() => undefined);
    if (hit) return (await hit.json()) as CloudflareUsage;
  }
  const usage = await fetchUsage(new Date());
  // เก็บ cache เฉพาะตอนที่ทุกส่วนสำเร็จ ถ้ามี error จะลองใหม่ครั้งถัดไปทันที
  if (cache && usage.workers.ok && usage.d1.ok && usage.r2.ok) {
    await cache
      .put(cacheKey(), new Response(JSON.stringify(usage), { headers: { "Cache-Control": `max-age=${CACHE_SECONDS}` } }))
      .catch(() => {});
  }
  return usage;
}
