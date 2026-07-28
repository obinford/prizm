// Pure parser for the MLB Stats API schedule?hydrate=lineups feed.
//
// No imports, on purpose: vitest exercises this file directly, and importing
// the ingest helpers would drag the MySQL connection module (api/ingest/
// common.ts imports getDb) into every consumer. This step must not depend on
// DATABASE_URL — the feed is keyless and the join keys are MLBAM ids.

export interface LineupOrder {
  /** 1-indexed spot in the batting order. Index 0 in the feed = leadoff = 1. */
  battingOrder: number
  /** primaryPosition.abbreviation from the feed, e.g. 'LF'. '' when absent. */
  position: string
  /** slug(fullName) — matches Batter.id, built by the same slug() as ingest. */
  slug: string
}

export interface ParsedLineups {
  date: string
  /** Keyed by MLBAM player id. */
  orders: Record<number, LineupOrder>
  /** gamePk of every game with a non-empty lineups object. */
  postedGamePks: number[]
  /** statsapi team ids per posted game — mapped to slate ids by the router. */
  teamsByGamePk: Record<number, { awayTeamId: number; homeTeamId: number }>
}

/**
 * Keep in sync with api/ingest/common.ts slug() — the same function,
 * duplicated so this module stays import-free. Frontend-compatible:
 * 'Tarik Skubal' -> 'tarik-skubal', diacritics stripped.
 */
export function slug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

/**
 * Parse one schedule response. A game whose lineups is {} (or absent) is not
 * posted yet — the normal state for most of the day. It contributes nothing:
 * not an error, not a retry, not a zero order.
 */
export function parseScheduleLineups(json: any, date: string): ParsedLineups {
  const orders: Record<number, LineupOrder> = {}
  const postedGamePks: number[] = []
  const teamsByGamePk: Record<number, { awayTeamId: number; homeTeamId: number }> = {}

  const dates: any[] = Array.isArray(json?.dates) ? json.dates : []
  for (const d of dates) {
    const games: any[] = Array.isArray(d?.games) ? d.games : []
    for (const g of games) {
      const lu = g?.lineups
      const home: any[] = Array.isArray(lu?.homePlayers) ? lu.homePlayers : []
      const away: any[] = Array.isArray(lu?.awayPlayers) ? lu.awayPlayers : []
      if (home.length === 0 && away.length === 0) continue // lineups: {} — not posted

      const pk = g?.gamePk
      if (typeof pk === "number") {
        postedGamePks.push(pk)
        const awayTeamId = g?.teams?.away?.team?.id
        const homeTeamId = g?.teams?.home?.team?.id
        if (typeof awayTeamId === "number" && typeof homeTeamId === "number") {
          teamsByGamePk[pk] = { awayTeamId, homeTeamId }
        }
      }

      const add = (players: any[]) => {
        players.forEach((p, i) => {
          const id = p?.id
          if (typeof id !== "number") return
          // Array index IS the batting order: index 0 = leadoff. Stored
          // 1-indexed — an off-by-one here is silent and wrong.
          orders[id] = {
            battingOrder: i + 1,
            position: p?.primaryPosition?.abbreviation ?? "",
            slug: slug(String(p?.fullName ?? "")),
          }
        })
      }
      add(home)
      add(away)
    }
  }

  return { date, orders, postedGamePks, teamsByGamePk }
}
