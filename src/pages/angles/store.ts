// My Angles — persistence layer (tRPC angles router, DB-backed) + snapshot builders.
// Snapshots are live data renders (per design.md §angles S3): we store compact
// cell data derived from the live player/props cache, never images.
//
// The store keeps its original SYNCHRONOUS API (getAngles/addAngle/updateAngle/
// deleteAngle/duplicateAngle/onAnglesChange) so every writer (dashboard,
// gamecenter, hit-rates, hockey, profiler) works unchanged. A React sync
// component (src/providers/UserDataSync.tsx) hydrates the module cache from
// trpc.angles.list and registers the API bridge; writers apply optimistic
// local updates and fire the matching mutation. Legacy localStorage
// prizm_angles are migrated to the DB once on first authed load.

import { getBatter, getPitcher, type Batter, type Pitcher } from '@/data/mlbPlayers'
import { getGoalie, getSkater, type Goalie, type Skater } from '@/data/nhlPlayers'
import { getPlayerProps, type PropLine } from '@/data/props'
import { deltaPct } from '@/lib/heat'

export type AngleType = 'table' | 'ai' | 'edge' | 'note'
export type Sport = 'mlb' | 'nhl'

export const ANGLE_TYPE_LABELS: Record<AngleType, string> = {
  table: 'Table save',
  ai: 'AI answer',
  edge: 'Edge',
  note: 'Note',
}

export interface HeatCellData {
  value: string
  /** raw % delta vs season baseline (stat direction) */
  deltaPct: number
}

export interface HeatRowData {
  label: string
  /** true when a lower stat value is better (ERA, xwOBA…) — flips heat polarity */
  invert?: boolean
  cells: HeatCellData[]
}

export interface HitbarData {
  label: string
  line: string
  rates: { L5: number; L10: number; L20: number }
  alert?: boolean
}

export interface AngleSnapshot {
  kind: 'heat' | 'hitbar' | 'text'
  /** e.g. "MLB Dashboards · Apr 2" */
  source: string
  heat?: { headers: string[]; rows: HeatRowData[] }
  hitbar?: HitbarData
  text?: string
}

export interface Angle {
  id: string
  title: string
  sport: Sport
  type: AngleType
  note: string
  tags: string[]
  shared: boolean
  createdAt: number
  snapshot: AngleSnapshot
}

const LEGACY_KEY = 'prizm_angles'
const EVENT = 'prizm-angles'

// ---------------------------------------------------------------------------
// Shape normalization — several legacy "Add to angle" writers stored alien
// shapes in prizm_angles (dashboard {name, items[]}, gamecenter
// {title, subtitle, source}, hockey {label, detail}, even bare strings).
// normalizeAngle upgrades ANY of those to the canonical Angle and never throws.
// ---------------------------------------------------------------------------

const VALID_TYPES: readonly AngleType[] = ['table', 'ai', 'edge', 'note']
const VALID_SPORTS: readonly Sport[] = ['mlb', 'nhl']

export function mintAngleId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    /* fall through to manual id */
  }
  return `angle-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const asStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Dashboard legacy angles collected items; fold them into a readable note. */
function itemsNote(items: unknown): string {
  if (!Array.isArray(items)) return ''
  return items
    .map((it) => {
      if (!it || typeof it !== 'object') return ''
      const o = it as Record<string, unknown>
      const label = asStr(o.label)
      const meta = asStr(o.meta)
      return label ? `• ${meta ? `${label} — ${meta}` : label}` : ''
    })
    .filter(Boolean)
    .join('\n')
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function normalizeSnapshot(raw: unknown, fallbackText: string): AngleSnapshot {
  const text = fallbackText || 'Saved from an older Prizm build.'
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const s = raw as Record<string, unknown>
    const source = asStr(s.source) || 'My Angles'
    if (s.kind === 'heat' && s.heat && typeof s.heat === 'object') {
      const h = s.heat as Record<string, unknown>
      const headers = Array.isArray(h.headers) ? h.headers.map(String) : []
      const rows = Array.isArray(h.rows)
        ? h.rows
            .filter((r) => r && typeof r === 'object' && Array.isArray((r as HeatRowData).cells))
            .map((r) => {
              const row = r as Record<string, unknown>
              return {
                label: asStr(row.label) || '—',
                invert: row.invert === true,
                cells: (row.cells as unknown[]).map((c) => {
                  const cell = (c ?? {}) as Record<string, unknown>
                  return { value: asStr(cell.value) || String(cell.value ?? ''), deltaPct: num(cell.deltaPct, 0) }
                }),
              }
            })
        : []
      if (headers.length && rows.length) return { kind: 'heat', source, heat: { headers, rows } }
    }
    if (s.kind === 'hitbar' && s.hitbar && typeof s.hitbar === 'object') {
      const hb = s.hitbar as Record<string, unknown>
      const rates = (hb.rates ?? {}) as Record<string, unknown>
      return {
        kind: 'hitbar',
        source,
        hitbar: {
          label: asStr(hb.label),
          line: asStr(hb.line),
          rates: { L5: num(rates.L5, 0), L10: num(rates.L10, 0), L20: num(rates.L20, 0) },
          alert: hb.alert === true,
        },
      }
    }
    if (s.kind === 'text') {
      return { kind: 'text', source, text: asStr(s.text) || text }
    }
  }
  return { kind: 'text', source: 'My Angles', text }
}

/**
 * Upgrade any stored value to a canonical Angle. Returns null only for values
 * that carry no usable content at all (null, numbers, empty strings, arrays).
 * Never throws.
 */
export function normalizeAngle(raw: unknown): Angle | null {
  try {
    if (raw == null) return null
    let obj: Record<string, unknown>
    if (typeof raw === 'string') {
      const s = raw.trim()
      if (!s) return null
      obj = { title: s.length > 80 ? `${s.slice(0, 80)}…` : s, note: s }
    } else if (typeof raw === 'object' && !Array.isArray(raw)) {
      obj = raw as Record<string, unknown>
    } else {
      return null
    }

    // title: canonical title → dashboard name → hockey label
    const title = asStr(obj.title) || asStr(obj.name) || asStr(obj.label) || 'Untitled angle'
    // note: canonical note → gamecenter subtitle → hockey detail → dashboard items
    const note = asStr(obj.note) || asStr(obj.subtitle) || asStr(obj.detail) || itemsNote(obj.items)

    const tags = Array.isArray(obj.tags)
      ? obj.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim())
      : asStr(obj.tags)
        ? [asStr(obj.tags)]
        : []

    const createdRaw = obj.createdAt ?? obj.addedAt
    let createdAt = typeof createdRaw === 'number' && Number.isFinite(createdRaw) && createdRaw > 0 ? createdRaw : NaN
    if (!Number.isFinite(createdAt)) {
      const parsed = Date.parse(asStr(createdRaw))
      createdAt = Number.isFinite(parsed) ? parsed : Date.now()
    }

    return {
      // Preserve any extra metadata (e.g. dashboard `items`) while forcing
      // every canonical field to exist with a sane value.
      ...obj,
      id: asStr(obj.id) || mintAngleId(),
      title,
      sport: VALID_SPORTS.includes(obj.sport as Sport) ? (obj.sport as Sport) : 'mlb',
      type: VALID_TYPES.includes(obj.type as AngleType) ? (obj.type as AngleType) : 'note',
      note,
      tags,
      shared: obj.shared === true,
      createdAt,
      snapshot: normalizeSnapshot(obj.snapshot, note || title),
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// DB-backed persistence with an optimistic module cache
// ---------------------------------------------------------------------------

/** Canonical fields the angles router accepts (matches api/anglesRouter.ts). */
export interface AngleApiInput {
  title: string
  sport: Sport
  type: AngleType
  note: string
  tags: string[]
  shared: boolean
  snapshot: AngleSnapshot
}

/** Minimal structural interface over the tRPC angles client. */
export interface AnglesApi {
  create(input: AngleApiInput): Promise<Angle>
  update(id: number, patch: Partial<AngleApiInput>): Promise<Angle>
  remove(id: number): Promise<unknown>
  duplicateAngle(id: number): Promise<Angle>
  /** Refetch angles.list so the next sync reflects the server. */
  invalidate(): void
}

let cache: Angle[] = []
let api: AnglesApi | null = null
/** Optimistic creates still awaiting their server row (keyed by temp id). */
const pendingCreates = new Set<string>()
/** Temp ids deleted locally before their server row arrived. */
const deleteOnArrival = new Set<string>()

/** Called by UserDataSync while the authed shell is mounted. */
export function registerAnglesApi(bridge: AnglesApi | null) {
  api = bridge
}

function notify() {
  window.dispatchEvent(new Event(EVENT))
}

function toApiInput(a: Angle): AngleApiInput {
  return {
    title: a.title,
    sport: a.sport,
    type: a.type,
    note: a.note,
    tags: a.tags,
    shared: a.shared,
    snapshot: a.snapshot,
  }
}

/** Replace the cache from the server; optimistic entries ride along. */
export function syncAnglesFromDb(rows: unknown[]) {
  const seen = new Set<string>()
  const out: Angle[] = []
  for (const row of rows) {
    const a = normalizeAngle(row)
    if (!a || seen.has(a.id)) continue
    seen.add(a.id)
    out.push(a)
  }
  // Keep optimistic entries whose server row hasn't landed yet.
  for (const a of cache) {
    if (pendingCreates.has(a.id) && !seen.has(a.id)) out.push(a)
  }
  cache = out
  notify()
}

export function getAngles(): Angle[] {
  return cache
}

export function addAngle(angle: Omit<Angle, 'id' | 'createdAt'> & { id?: string }): Angle {
  let id = asStr(angle.id) || `tmp-${mintAngleId()}`
  // Defensive: never keep a caller-supplied id that already exists.
  while (cache.some((a) => a.id === id)) id = `tmp-${mintAngleId()}`
  const saved = normalizeAngle({ ...angle, id, createdAt: Date.now() }) as Angle
  cache = [saved, ...cache]
  pendingCreates.add(id)
  notify()

  if (api) {
    const tempId = id
    api
      .create(toApiInput(saved))
      .then((row) => {
        const server = normalizeAngle(row)
        pendingCreates.delete(tempId)
        if (!server) return
        if (deleteOnArrival.has(tempId)) {
          deleteOnArrival.delete(tempId)
          const n = Number(server.id)
          if (Number.isInteger(n)) void api?.remove(n).then(() => api?.invalidate())
          return
        }
        cache = cache.map((a) => (a.id === tempId ? { ...a, ...server } : a))
        notify()
      })
      .catch(() => {
        // Roll back the optimistic create.
        pendingCreates.delete(tempId)
        cache = cache.filter((a) => a.id !== tempId)
        notify()
      })
      .finally(() => api?.invalidate())
  }
  return saved
}

export function updateAngle(id: string, patch: Partial<Angle> & Record<string, unknown>) {
  const target = cache.find((a) => a.id === id)
  if (!target) return
  const merged = { ...target, ...patch }
  // The DB stores canonical fields only — fold collected dashboard items into
  // the note so the content survives the round trip.
  if ('items' in patch && patch.note === undefined) {
    const folded = itemsNote((patch as { items?: unknown }).items)
    if (folded) merged.note = merged.note ? `${merged.note}\n${folded}` : folded
  }
  cache = cache.map((a) => (a.id === id ? merged : a))
  notify()

  const serverId = Number(id)
  if (api && Number.isInteger(serverId)) {
    // Contract caveat: the server's patch schema applies zod DEFAULTS to
    // omitted fields (note→"", tags→[], sport→"mlb"…), wiping them. Always
    // send the full canonical object so untouched fields survive.
    if (
      patch.title !== undefined ||
      patch.sport !== undefined ||
      patch.type !== undefined ||
      patch.note !== undefined ||
      'items' in patch ||
      patch.tags !== undefined ||
      patch.shared !== undefined ||
      patch.snapshot !== undefined
    ) {
      void api
        .update(serverId, toApiInput(merged))
        .catch(() => api?.invalidate())
        .finally(() => api?.invalidate())
    }
  }
}

export function deleteAngle(id: string) {
  cache = cache.filter((a) => a.id !== id)
  notify()
  if (pendingCreates.has(id)) {
    // Server row hasn't landed — delete it when it does.
    pendingCreates.delete(id)
    deleteOnArrival.add(id)
    return
  }
  const serverId = Number(id)
  if (api && Number.isInteger(serverId)) {
    void api
      .remove(serverId)
      .catch(() => api?.invalidate())
      .finally(() => api?.invalidate())
  }
}

export function duplicateAngle(id: string): Angle | null {
  const src = cache.find((a) => a.id === id)
  if (!src) return null
  const serverId = Number(id)
  if (api && Number.isInteger(serverId)) {
    // Optimistic copy; the server assigns the real row.
    const tempId = `tmp-${mintAngleId()}`
    const copy = { ...src, id: tempId, title: `${src.title} (copy)`, shared: false, createdAt: Date.now() }
    cache = [copy, ...cache]
    pendingCreates.add(tempId)
    notify()
    api
      .duplicateAngle(serverId)
      .then((row) => {
        const server = normalizeAngle(row)
        pendingCreates.delete(tempId)
        if (!server) return
        cache = cache.map((a) => (a.id === tempId ? { ...a, ...server } : a))
        notify()
      })
      .catch(() => {
        pendingCreates.delete(tempId)
        cache = cache.filter((a) => a.id !== tempId)
        notify()
      })
      .finally(() => api?.invalidate())
    return copy
  }
  // Offline fallback (no API bridge): local-only copy.
  const { id: _srcId, createdAt: _srcCreated, ...rest } = src
  return addAngle({
    ...rest,
    title: `${src.title} (copy)`,
    shared: false,
  })
}

export function getAngle(id: string): Angle | undefined {
  return cache.find((a) => a.id === id)
}

/** Subscribe to same-tab angle changes (cross-tab via storage, legacy). */
export function onAnglesChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

// ---------------------------------------------------------------------------
// One-time migration: localStorage prizm_angles → DB (first authed load)
// ---------------------------------------------------------------------------

let migrationPromise: Promise<boolean> | null = null

/**
 * Migrate legacy localStorage angles into the DB once, then clear the key.
 * Returns true when rows were migrated (caller should invalidate the list).
 */
export function migrateLegacyAngles(
  createFn: (input: AngleApiInput) => Promise<unknown>,
): Promise<boolean> {
  if (migrationPromise) return migrationPromise
  migrationPromise = (async () => {
    try {
      const raw = localStorage.getItem(LEGACY_KEY)
      if (!raw) return false
      const list = JSON.parse(raw)
      if (!Array.isArray(list) || list.length === 0) {
        localStorage.removeItem(LEGACY_KEY)
        return false
      }
      let migrated = 0
      for (const item of list) {
        const a = normalizeAngle(item)
        if (!a) continue
        try {
          await createFn(toApiInput(a))
          migrated++
        } catch {
          // Skip rows the server rejects; keep going.
        }
      }
      localStorage.removeItem(LEGACY_KEY)
      return migrated > 0
    } catch {
      return false
    }
  })()
  return migrationPromise
}

// ---------------------------------------------------------------------------
// Snapshot builders — pull real window data so cards stay "live"
// ---------------------------------------------------------------------------

const fmt3 = (v: number) => v.toFixed(3).replace(/^0/, '')
const fmt2 = (v: number) => v.toFixed(2)
const fmt1 = (v: number) => v.toFixed(1)

const MLB_KEYS = ['L30', 'L60', 'L90', 'L120'] as const
const NHL_KEYS = ['MIN60', 'MIN120', 'MIN180', 'MIN240'] as const

function batterHeat(b: Batter): AngleSnapshot['heat'] {
  const w = b.windows
  return {
    headers: ['L30', 'L60', 'L90', 'L120'],
    rows: [
      {
        label: 'AVG',
        cells: MLB_KEYS.map((k) => ({
          value: fmt3(w[k].avg),
          deltaPct: deltaPct(w[k].avg, b.avg),
        })),
      },
      {
        label: 'ISO',
        cells: MLB_KEYS.map((k) => ({
          value: fmt3(w[k].iso),
          deltaPct: deltaPct(w[k].iso, b.iso),
        })),
      },
      {
        label: 'TB/G',
        cells: MLB_KEYS.map((k) => ({
          value: fmt2(w[k].tb),
          deltaPct: deltaPct(w[k].tb, b.tb),
        })),
      },
    ],
  }
}

function pitcherHeat(p: Pitcher): AngleSnapshot['heat'] {
  const w = p.windows
  return {
    headers: ['L30', 'L60', 'L90', 'L120'],
    rows: [
      {
        label: 'ERA',
        invert: true,
        cells: MLB_KEYS.map((k) => ({ value: fmt2(w[k].era), deltaPct: deltaPct(w[k].era, p.era) })),
      },
      {
        label: 'K%',
        cells: MLB_KEYS.map((k) => ({
          value: `${(w[k].kPct * 100).toFixed(1)}%`,
          deltaPct: deltaPct(w[k].kPct, p.kPct),
        })),
      },
      {
        label: 'xwOBA',
        invert: true,
        cells: MLB_KEYS.map((k) => ({ value: fmt3(w[k].xwoba), deltaPct: deltaPct(w[k].xwoba, p.xwoba) })),
      },
    ],
  }
}

function skaterHeat(s: Skater): AngleSnapshot['heat'] {
  const w = s.windows
  return {
    headers: ['60', '120', '180', '240'],
    rows: [
      {
        label: 'SOG/G',
        cells: NHL_KEYS.map((k) => ({ value: fmt1(w[k].sog), deltaPct: deltaPct(w[k].sog, s.sog) })),
      },
      {
        label: 'G/G',
        cells: NHL_KEYS.map((k) => ({ value: fmt2(w[k].goals), deltaPct: deltaPct(w[k].goals, s.goals) })),
      },
      {
        label: 'PTS/G',
        cells: NHL_KEYS.map((k) => ({ value: fmt2(w[k].points), deltaPct: deltaPct(w[k].points, s.points) })),
      },
    ],
  }
}

function goalieHeat(g: Goalie): AngleSnapshot['heat'] {
  const w = g.windows
  const rows: HeatRowData[] = [
    {
      label: 'SV%',
      cells: NHL_KEYS.map((k) => ({ value: fmt3(w[k].svPct), deltaPct: deltaPct(w[k].svPct, g.svPct) })),
    },
  ]
  // GSAx can be null (no public xG feed) — skip the heat row entirely rather
  // than rendering fabricated deltas.
  if (g.gsax != null && NHL_KEYS.every((k) => w[k].gsax != null)) {
    rows.push({
      label: 'GSAx',
      cells: NHL_KEYS.map((k) => ({
        value: fmt1(w[k].gsax as number),
        deltaPct: deltaPct(w[k].gsax as number, g.gsax as number),
      })),
    })
  }
  return {
    headers: ['60', '120', '180', '240'],
    rows,
  }
}

const SOURCE_LABEL: Record<Sport, string> = { mlb: 'MLB Dashboards', nhl: 'Hockey Dashboards' }

/** Heat-table snapshot for any player id (used by Profiler "Add to angle" + Attach row). */
export function playerSnapshot(playerId: string): { snapshot: AngleSnapshot; sport: Sport; title: string } | null {
  const b = getBatter(playerId)
  if (b)
    return {
      sport: 'mlb',
      title: `${b.name} — batting splits`,
      snapshot: { kind: 'heat', source: `${SOURCE_LABEL.mlb} · ${shortDate()}`, heat: batterHeat(b) },
    }
  const p = getPitcher(playerId)
  if (p)
    return {
      sport: 'mlb',
      title: `${p.name} — pitching splits`,
      snapshot: { kind: 'heat', source: `${SOURCE_LABEL.mlb} · ${shortDate()}`, heat: pitcherHeat(p) },
    }
  const s = getSkater(playerId)
  if (s)
    return {
      sport: 'nhl',
      title: `${s.name} — skater splits`,
      snapshot: { kind: 'heat', source: `${SOURCE_LABEL.nhl} · ${shortDate()}`, heat: skaterHeat(s) },
    }
  const g = getGoalie(playerId)
  if (g)
    return {
      sport: 'nhl',
      title: `${g.name} — goalie splits`,
      snapshot: { kind: 'heat', source: `${SOURCE_LABEL.nhl} · ${shortDate()}`, heat: goalieHeat(g) },
    }
  return null
}

export function propSnapshot(prop: PropLine): AngleSnapshot {
  return {
    kind: 'hitbar',
    source: `Hit Rates · ${shortDate()}`,
    hitbar: {
      label: `${prop.player} — ${prop.market}`,
      line: `O ${prop.line} (${prop.overPrice > 0 ? '+' : ''}${prop.overPrice})`,
      rates: { ...prop.hitRates },
      alert: prop.priceAlert,
    },
  }
}

/** Hit-rate snapshot for the first prop of a player. */
export function playerPropSnapshot(playerId: string): { snapshot: AngleSnapshot; sport: Sport; title: string } | null {
  const prop = getPlayerProps(playerId)[0]
  if (!prop) return null
  return { sport: prop.sport, title: `${prop.player} ${prop.market} hit rate`, snapshot: propSnapshot(prop) }
}

export function textSnapshot(text: string, source: string): AngleSnapshot {
  return { kind: 'text', source, text }
}

/**
 * One-call note save shared by Hit Rates (and formerly the hockey drawers).
 * Moved here from src/pages/hockey/extras.tsx in Step 10.2 when the NHL
 * fabrication was gated — the hockey module is deleted, the save stays.
 */
export function saveAngle(label: string, detail: string, sport: Sport): void {
  try {
    addAngle({
      title: label,
      sport,
      type: 'note',
      note: detail,
      tags: [],
      shared: false,
      snapshot: textSnapshot(detail || label, `Hit Rates · ${shortDate()}`),
    })
  } catch {
    /* angle persistence is best-effort from a table row action */
  }
}

export function shortDate(d = new Date()): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ---------------------------------------------------------------------------
// Preset "recent saves" for the New Angle attach row + the demo seed
// ---------------------------------------------------------------------------

export interface AttachOption {
  id: string
  label: string
  sport: Sport
  type: AngleType
  title: string
  snapshot: AngleSnapshot
}

export function attachOptions(): AttachOption[] {
  const out: AttachOption[] = []
  const judge = playerSnapshot('aaron-judge')
  if (judge) out.push({ id: 'att-judge', label: 'Aaron Judge · split table', sport: 'mlb', type: 'table', title: judge.title, snapshot: judge.snapshot })
  const skubal = playerSnapshot('tarik-skubal')
  if (skubal) out.push({ id: 'att-skubal', label: 'Tarik Skubal · split table', sport: 'mlb', type: 'table', title: skubal.title, snapshot: skubal.snapshot })
  const mack = playerPropSnapshot('nathan-mackinnon')
  if (mack) out.push({ id: 'att-mack', label: 'MacKinnon · SOG hit rate', sport: 'nhl', type: 'edge', title: mack.title, snapshot: mack.snapshot })
  const wolf = playerPropSnapshot('dustin-wolf')
  if (wolf) out.push({ id: 'att-wolf', label: 'Dustin Wolf · Saves hit rate', sport: 'nhl', type: 'edge', title: wolf.title, snapshot: wolf.snapshot })
  // Removed: the 'att-ask' preset. It attached a canned "Ask Prizm" answer with
  // invented statistics under an AI label; the Ask Prizm surface itself was
  // deleted for the same rule-1 violation. Real snapshots above remain.
  return out
}

/** One demo card for the empty-state "See an example angle" button.
 * The snapshot is real (live split table when hydrated); the note is
 * explicitly a placeholder so no invented stat claims ship as prose. */
export function exampleAngle(): Omit<Angle, 'id' | 'createdAt'> {
  const raleigh = playerSnapshot('cal-raleigh')
  return {
    title: 'Example angle — total bases over',
    sport: 'mlb',
    type: 'table',
    note: 'This is a demo. Your note is where the reasoning goes: the window you are watching, the matchup, and what would make you get off the angle.',
    tags: ['tb-over', 'hot-window'],
    shared: false,
    snapshot: raleigh?.snapshot ?? textSnapshot('Saved from the MLB dashboard split table.', `MLB Dashboards · ${shortDate()}`),
  }
}
