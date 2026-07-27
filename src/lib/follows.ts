// Follows — DB-backed (tRPC follows router) with an optimistic module cache,
// same pattern as the angles store. UserDataSync (src/providers/UserDataSync.tsx)
// hydrates the cache from trpc.follows.list and registers the API bridge on
// authed shell mount. Legacy localStorage keys (prizm_followed from the
// profiler, prizm_follows from EdgeCenter) migrate to the DB once, then clear.

import { getBatter, getPitcher } from '@/data/mlbPlayers'
import { getGoalie, getSkater } from '@/data/nhlPlayers'

export type Sport = 'mlb' | 'nhl'

export interface FollowEntry {
  playerId: string // slug
  sport: Sport
  name: string
  team: string
  role: string
  createdAt: number
}

/** Minimal structural interface over the tRPC follows client. */
export interface FollowsApi {
  add(input: { sport: Sport; playerId: string }): Promise<FollowEntry>
  remove(input: { sport: Sport; playerId: string }): Promise<unknown>
  invalidate(): void
}

const LEGACY_KEYS = ['prizm_followed', 'prizm_follows']
const EVENT = 'prizm-follows'

let cache: FollowEntry[] = []
let api: FollowsApi | null = null

/** Called by UserDataSync while the authed shell is mounted. */
export function registerFollowsApi(bridge: FollowsApi | null) {
  api = bridge
}

function notify() {
  window.dispatchEvent(new Event(EVENT))
}

/** Replace the cache from the server list (FollowDto rows). */
export function syncFollowsFromDb(rows: FollowEntry[]) {
  cache = rows.map((r) => ({
    playerId: String(r.playerId),
    sport: r.sport === 'nhl' ? 'nhl' : 'mlb',
    name: String(r.name ?? ''),
    team: String(r.team ?? ''),
    role: String(r.role ?? ''),
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
  }))
  notify()
}

export function getFollows(): FollowEntry[] {
  return cache
}

export function getFollowedIds(): string[] {
  return cache.map((f) => f.playerId)
}

export function isFollowed(playerId: string): boolean {
  return cache.some((f) => f.playerId === playerId)
}

/**
 * Toggle a follow. Optimistic: the cache flips immediately and the API call
 * follows; on failure the server list is re-synced (rollback). Returns the new
 * followed state.
 */
export function toggleFollow(player: {
  id: string
  sport: Sport
  name: string
  team: string
  role: string
}): boolean {
  const existing = cache.find((f) => f.playerId === player.id)
  const nowFollowing = !existing
  if (existing) {
    cache = cache.filter((f) => f.playerId !== player.id)
  } else {
    cache = [
      {
        playerId: player.id,
        sport: player.sport,
        name: player.name,
        team: player.team,
        role: player.role,
        createdAt: Date.now(),
      },
      ...cache,
    ]
  }
  notify()

  if (api) {
    const req = { sport: player.sport, playerId: player.id }
    const call = nowFollowing ? api.add(req) : api.remove(req)
    void Promise.resolve(call)
      .catch(() => api?.invalidate())
      .finally(() => api?.invalidate())
  }
  return nowFollowing
}

/** Subscribe to same-tab follow changes. */
export function onFollowsChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb)
  return () => {
    window.removeEventListener(EVENT, cb)
  }
}

// ---------------------------------------------------------------------------
// One-time migration: localStorage follow lists → DB (first authed load)
// ---------------------------------------------------------------------------

let migrationPromise: Promise<boolean> | null = null

function legacyIds(): string[] {
  const out = new Set<string>()
  for (const key of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const list = JSON.parse(raw)
      if (Array.isArray(list)) {
        for (const id of list) if (typeof id === 'string' && id) out.add(id)
      }
    } catch {
      /* ignore malformed key */
    }
  }
  return [...out]
}

/** Resolve a slug's sport from the live player cache (hydrated by then). */
function sportFor(playerId: string): Sport | null {
  if (getPitcher(playerId) ?? getBatter(playerId)) return 'mlb'
  if (getGoalie(playerId) ?? getSkater(playerId)) return 'nhl'
  return null
}

/**
 * Migrate legacy localStorage follows into the DB once, then clear the keys.
 * Returns true when rows were migrated (caller should invalidate the list).
 */
export function migrateLegacyFollows(
  addFn: (input: { sport: Sport; playerId: string }) => Promise<unknown>,
): Promise<boolean> {
  if (migrationPromise) return migrationPromise
  migrationPromise = (async () => {
    try {
      const ids = legacyIds()
      if (ids.length === 0) {
        for (const key of LEGACY_KEYS) localStorage.removeItem(key)
        return false
      }
      let migrated = 0
      for (const playerId of ids) {
        const sport = sportFor(playerId)
        if (!sport) continue // unknown player — nothing to migrate honestly
        try {
          await addFn({ sport, playerId })
          migrated++
        } catch {
          // Skip rows the server rejects; keep going.
        }
      }
      for (const key of LEGACY_KEYS) localStorage.removeItem(key)
      return migrated > 0
    } catch {
      return false
    }
  })()
  return migrationPromise
}
