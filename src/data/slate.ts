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
  gamePk?: number // MLBAM gamePk from sv_slate
  total?: number // game total line
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
