// Prizm LIVE data — today's slate (MLB + NHL games) from the tRPC API
// (slate.today), hydrated into these arrays by src/data/live.ts (see
// LiveDataProvider). NHL probable goalies may be absent — consumers render
// "TBD" fallbacks.

export interface SlateGame {
  id: string
  sport: 'mlb' | 'nhl'
  away: string // team abbr
  home: string
  startTime: string // e.g. '7:05 PM ET'
  venue: string
  awayProbable?: string // pitcher / goalie name
  homeProbable?: string
  awayProbableId?: string
  homeProbableId?: string
  /** Probable pitcher's throwing hand, from sv_slate. Null = not announced. */
  awayProbableHand?: 'L' | 'R' | null
  homeProbableHand?: 'L' | 'R' | null
  gamePk?: number // MLBAM gamePk from sv_slate
  /** Game total line. Null = no joinable odds event (or no key) — em-dash. */
  total?: number | null
  // ── The Odds API game odds (FIX 19, MLB only) — cross-book means, `us` ──
  moneylineHome?: number | null
  moneylineAway?: number | null
  runline?: number | null // home spread, typically -1.5
  runlineHomePrice?: number | null
  runlineAwayPrice?: number | null
  totalOverPrice?: number | null
  totalUnderPrice?: number | null
  note?: string
}

export const SLATE_DATE_LABEL = 'Today'

/** Populated by hydrateLiveData() at AppShell mount. */
export const MLB_SLATE: SlateGame[] = []

export const NHL_SLATE: SlateGame[] = []

export const TODAYS_SLATE: SlateGame[] = []

export function getSlate(sport?: 'mlb' | 'nhl'): SlateGame[] {
  if (sport === 'mlb') return MLB_SLATE
  if (sport === 'nhl') return NHL_SLATE
  return TODAYS_SLATE
}

export function getGame(id: string): SlateGame | undefined {
  return TODAYS_SLATE.find((g) => g.id === id)
}
