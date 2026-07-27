// Shared helpers for ingestion: paced fetching, retries, slugging, run logging.

import { getDb } from "../queries/connection";
import { ingestionRuns } from "@db/schema";
import { eq } from "drizzle-orm";

export const REQUEST_DELAY_MS = 120;

let lastFetchAt = 0;

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Sequential, paced JSON fetch with one retry on failure. */
export async function fetchJson<T = any>(url: string, opts: { retries?: number } = {}): Promise<T> {
  const retries = opts.retries ?? 1;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    // pace requests
    const wait = REQUEST_DELAY_MS - (Date.now() - lastFetchAt);
    if (wait > 0) await sleep(wait);
    lastFetchAt = Date.now();
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "prizm-ingest/1.0", accept: "application/json" },
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      console.warn(`  [fetch] attempt ${attempt + 1} failed: ${(err as Error).message}`);
      if (attempt < retries) await sleep(1500);
    }
  }
  throw lastErr;
}

/** Frontend-compatible slug: 'Tarik Skubal' -> 'tarik-skubal'. */
export function slug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function startRun(source: string): Promise<number> {
  const [{ id }] = await getDb()
    .insert(ingestionRuns)
    .values({ source, status: "running", rows: 0 })
    .$returningId();
  console.log(`\n=== [ingest:${source}] started ${new Date().toISOString()} ===`);
  return id;
}

export async function finishRun(
  runId: number,
  status: "ok" | "error",
  rows: number,
  message?: string,
) {
  await getDb()
    .update(ingestionRuns)
    .set({ status, rows, message: message ?? null, finishedAt: new Date() })
    .where(eq(ingestionRuns.id, runId));
  console.log(`=== [ingest] run ${runId} ${status}: ${rows} rows ${message ?? ""} ===\n`);
}

/** Parse MLB innings-pitched notation ("7.1" = 7 1/3) into outs. */
export function ipToOuts(ip: string | number | undefined | null): number {
  if (ip === undefined || ip === null || ip === "") return 0;
  const s = String(ip);
  const [whole, frac] = s.split(".");
  return parseInt(whole || "0", 10) * 3 + parseInt(frac || "0", 10);
}

/** Parse NHL "MM:SS" time-on-ice into minutes. */
export function toiToMinutes(toi: string | undefined | null): number {
  if (!toi) return 0;
  const [m, s] = toi.split(":").map((x) => parseInt(x || "0", 10));
  return m + (s || 0) / 60;
}

export function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function todayEt(): string {
  // ET date string YYYY-MM-DD
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}
