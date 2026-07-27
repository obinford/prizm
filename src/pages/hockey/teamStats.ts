// NHL team stats — deterministic simulated season + rolling windows for the
// Team Stats tab. Seeded from team abbreviation so values are stable.

export interface TeamWindow {
  games: number
  gf: number // goals for / game
  ga: number // goals against / game
  xgfPct: number // expected goals share %
  ppPct: number
  pkPct: number
}

export interface TeamStats {
  abbr: string
  season: Omit<TeamWindow, 'games'>
  l5: TeamWindow
  l10: TeamWindow
  l20: TeamWindow
  /** last 10 results, most recent last; true = win */
  last10: boolean[]
  home: { gf: number; ga: number }
  away: { gf: number; ga: number }
  /** pace lean vs league-average scoring environment */
  pace: 'Over' | 'Under'
  /** strength rank 1–32 by season xGF% (1 = strongest) */
  rank: number
}

export const NHL_TEAMS = [
  'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL', 'DAL', 'DET', 'EDM',
  'FLA', 'LA', 'MIN', 'MTL', 'NJ', 'NSH', 'NYI', 'NYR', 'OTT', 'PHI', 'PIT',
  'SEA', 'SJ', 'STL', 'TB', 'TOR', 'UTA', 'VAN', 'VGK', 'WPG', 'WSH',
]

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildTeam(abbr: string): TeamStats {
  const rand = mulberry32(hash(abbr))
  // Quality 0–1 drives everything; roughly bell-distributed.
  const q = Math.min(0.98, Math.max(0.02, 0.35 + rand() * 0.45 + (rand() - 0.5) * 0.2))
  const gf = +(2.4 + q * 1.5).toFixed(2)
  const ga = +(4.05 - q * 1.5).toFixed(2)
  const xgfPct = +(44 + q * 14).toFixed(1)
  const ppPct = +(15 + q * 12 + (rand() - 0.5) * 3).toFixed(1)
  const pkPct = +(72 + q * 12 + (rand() - 0.5) * 3).toFixed(1)

  const mkWindow = (games: number, jitter: number): TeamWindow => ({
    games,
    gf: +Math.max(1.2, gf * (1 + (rand() - 0.5) * jitter)).toFixed(2),
    ga: +Math.max(1.2, ga * (1 + (rand() - 0.5) * jitter)).toFixed(2),
    xgfPct: +Math.min(64, Math.max(38, xgfPct + (rand() - 0.5) * jitter * 18)).toFixed(1),
    ppPct: +Math.min(40, Math.max(8, ppPct + (rand() - 0.5) * jitter * 30)).toFixed(1),
    pkPct: +Math.min(96, Math.max(60, pkPct + (rand() - 0.5) * jitter * 25)).toFixed(1),
  })

  const last10 = Array.from({ length: 10 }, () => rand() < 0.28 + q * 0.45)
  const env = gf + ga
  return {
    abbr,
    season: { gf, ga, xgfPct, ppPct, pkPct },
    l5: mkWindow(5, 0.36),
    l10: mkWindow(10, 0.22),
    l20: mkWindow(20, 0.12),
    last10,
    home: { gf: +(gf * 1.05).toFixed(2), ga: +(ga * 0.95).toFixed(2) },
    away: { gf: +(gf * 0.95).toFixed(2), ga: +(ga * 1.05).toFixed(2) },
    pace: env >= 6.1 ? 'Over' : 'Under',
    rank: 0, // filled below
  }
}

export const TEAM_STATS: TeamStats[] = (() => {
  const teams = NHL_TEAMS.map(buildTeam)
  const sorted = [...teams].sort((a, b) => b.season.xgfPct - a.season.xgfPct)
  sorted.forEach((t, i) => {
    t.rank = i + 1
  })
  return teams
})()

export function getTeamStats(abbr: string): TeamStats | undefined {
  return TEAM_STATS.find((t) => t.abbr === abbr)
}

/** League-average total goals per game environment (for pace context). */
export const LEAGUE_AVG_TOTAL = +(
  TEAM_STATS.reduce((s, t) => s + t.season.gf + t.season.ga, 0) / TEAM_STATS.length
).toFixed(2)
