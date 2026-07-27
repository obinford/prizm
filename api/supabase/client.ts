// Tiny typed PostgREST client for the rtm-data-warehouse Supabase project.
// No new npm deps — plain fetch with apikey/Authorization headers.
// Features: query-builder helpers (select/eq/in/order/limit), 15s timeout,
// 1 retry, in-memory cache with 5-minute TTL keyed by full URL.

import { supabaseConfig } from "./config";

const TIMEOUT_MS = 15_000;
const RETRIES = 1;
const CACHE_TTL_MS = 5 * 60 * 1000;
/** PostgREST default page size — we paginate in 1000-row chunks. */
const PAGE = 1000;

interface CacheEntry {
  at: number;
  data: unknown;
}
const cache = new Map<string, CacheEntry>();

function cacheGet(url: string): unknown | undefined {
  const hit = cache.get(url);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(url);
    return undefined;
  }
  return hit.data;
}

/** Drop expired entries (and allow tests to reset state). */
export function clearSupabaseCache() {
  cache.clear();
}

async function fetchOnce(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        apikey: supabaseConfig.key,
        Authorization: `Bearer ${supabaseConfig.key}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`PostgREST ${res.status} for ${url}: ${body.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Cached GET of an arbitrary PostgREST path (e.g. "sv_slate?select=*"). */
export async function pgGet<T = unknown>(path: string): Promise<T> {
  const url = `${supabaseConfig.url}/rest/v1/${path}`;
  const hit = cacheGet(url);
  if (hit !== undefined) return hit as T;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const data = await fetchOnce(url);
      cache.set(url, { at: Date.now(), data });
      return data as T;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/** Fluent query builder for a single table. */
export class PgQuery<T = Record<string, unknown>> {
  private params: string[] = [];
  constructor(private table: string) {}

  select(cols: string[] | string = "*"): this {
    this.params.push(`select=${Array.isArray(cols) ? cols.join(",") : cols}`);
    return this;
  }
  eq(col: string, val: string | number | boolean): this {
    this.params.push(`${col}=eq.${encodeURIComponent(String(val))}`);
    return this;
  }
  in(col: string, vals: (string | number)[]): this {
    const list = vals.map((v) => encodeURIComponent(String(v))).join(",");
    this.params.push(`${col}=in.(${list})`);
    return this;
  }
  gte(col: string, val: string | number): this {
    this.params.push(`${col}=gte.${encodeURIComponent(String(val))}`);
    return this;
  }
  order(col: string, opts: { desc?: boolean } = {}): this {
    this.params.push(`order=${col}.${opts.desc ? "desc" : "asc"}`);
    return this;
  }
  limit(n: number): this {
    this.params.push(`limit=${n}`);
    return this;
  }

  path(offset = 0): string {
    const qs = this.params.join("&");
    return `${this.table}?${qs}${qs ? "&" : ""}offset=${offset}`;
  }

  /** Fetch all matching rows, auto-paginating 1000-row PostgREST pages. */
  async all(): Promise<T[]> {
    const out: T[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const page = await pgGet<T[]>(this.path(offset));
      out.push(...page);
      if (page.length < PAGE) return out;
    }
  }
}

export function pg<T = Record<string, unknown>>(table: string): PgQuery<T> {
  return new PgQuery<T>(table);
}
