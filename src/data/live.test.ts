// Live-bridge hydration + Statcast/odds helper tests.
// Verifies the additive sv_* fields flow through hydrateLiveData untouched
// (same objects, in-place array swap) and that the scale-aware formatters and
// real-odds display helpers behave per contract (sv percents 0–100, legacy
// kPct/bbPct 0–1, rate stats 0–1).

import { describe, expect, it } from 'vitest'
import { hydrateLiveData, isLiveDataHydrated, type LiveDatasets } from './live'
import { PITCHERS, BATTERS, type Pitcher } from './mlbPlayers'
import { PROPS, bestOverTag, consensusOver, consensusUnder, hasRealOdds, type PropLine } from './props'
import { MLB_SLATE, NHL_SLATE } from './slate'
import { GOALIES } from './nhlPlayers'
import { fmtRate, fmtSvPct, hasSavant, svSplitChips } from '@/lib/savant'

const pitcher: Pitcher = {
  id: 'tarik-skubal',
  sport: 'mlb',
  kind: 'pitcher',
  name: 'Tarik Skubal',
  team: 'DET',
  throws: 'L',
  role: 'SP',
  era: 2.21,
  whip: 0.92,
  kPct: 0.312, // legacy 0–1
  bbPct: 0.052,
  xwoba: 0.261, // mirrors real sv xwOBA when covered
  xwobaReal: 0.261,
  xba: 0.208,
  xslg: 0.334,
  barrelPct: 6.1, // sv scale 0–100
  hardHitPct: 33.4,
  whiffPct: 31.9,
  cswPct: 29.4,
  avgEv: 87.2,
  woba: 0.255,
  babip: 0.272,
  windows: {
    L30: { bf: 112, era: 1.98, whip: 0.88, kPct: 0.335, bbPct: 0.048, xwoba: 0.251, barrelPct: 5.8, whiffPct: 33.1 },
    L60: { bf: 224, era: 2.05, whip: 0.9, kPct: 0.328, bbPct: 0.05, xwoba: 0.256 },
    L90: { bf: 336, era: 2.12, whip: 0.91, kPct: 0.321, bbPct: 0.051, xwoba: 0.259 },
    L120: { bf: 448, era: 2.18, whip: 0.92, kPct: 0.315, bbPct: 0.052, xwoba: 0.26 },
  },
  splits: {
    vsL: { pa: 96, kPct: 34.4, bbPct: 3.1, xwoba: 0.238 }, // sv scale 0–100
    vsR: { pa: 412, kPct: 30.8, bbPct: 5.6, xwoba: 0.267 },
    home: { pa: 260, kPct: 32.1, bbPct: 4.8 },
    away: { pa: 248, kPct: 30.2, bbPct: 5.4 },
  },
}

const svProp: PropLine = {
  id: 'prop-sv-669373-strikeouts-thrown',
  sport: 'mlb',
  playerId: 'tarik-skubal',
  player: 'Tarik Skubal',
  team: 'DET',
  opponent: 'vs CLE',
  market: 'Strikeouts',
  line: 7.5,
  overPrice: 108, // best over price
  underPrice: -130,
  hitRates: { L5: 0.8, L10: 0.7, L20: 0.65 },
  priceAlert: true,
  edgeScore: 82,
  gameId: 'g1',
  svPropType: 'strikeouts thrown',
  overBook: 'Novig',
  underBook: 'FanDuel',
  consOver: -110,
  consUnder: -110,
  books: 14,
  pulledAt: '2026-04-01T12:00:00Z',
  oddsSource: 'sv_odds',
}

const nhlProp: PropLine = {
  id: 'prop-9',
  sport: 'nhl',
  playerId: 'connor-mcdavid',
  player: 'Connor McDavid',
  team: 'EDM',
  opponent: '@ CGY',
  market: 'Points',
  line: 1.5,
  overPrice: -115,
  underPrice: -115,
  hitRates: { L5: 0.6, L10: 0.7, L20: 0.65 },
  gameId: 'g2',
  oddsSource: 'flat',
}

function datasets(overrides: Partial<LiveDatasets> = {}): LiveDatasets {
  return {
    pitchers: [pitcher],
    batters: [],
    goalies: [],
    skaters: [],
    slate: [
      { id: 'g1', sport: 'mlb', away: 'DET', home: 'CLE', startTime: '6:40 PM ET', venue: 'Progressive Field' },
      { id: 'g2', sport: 'nhl', away: 'EDM', home: 'CGY', startTime: '9:00 PM ET', venue: 'Saddledome' },
    ],
    props: [svProp, nhlProp],
    bullpens: [],
    ...overrides,
  }
}

describe('hydrateLiveData', () => {
  it('passes additive sv fields through on the same objects', () => {
    hydrateLiveData(datasets())
    expect(isLiveDataHydrated()).toBe(true)

    const p = PITCHERS[0]
    expect(p).toBe(pitcher) // same object identity — fields flow untouched
    expect(p.xwobaReal).toBe(0.261)
    expect(p.barrelPct).toBe(6.1)
    expect(p.whiffPct).toBe(31.9)
    expect(p.splits?.vsL?.kPct).toBe(34.4) // sv 0–100 scale preserved
    expect(p.kPct).toBe(0.312) // legacy 0–1 scale preserved
    expect(p.windows.L30.barrelPct).toBe(5.8)

    expect(PROPS[0]).toBe(svProp)
    expect(PROPS[0].oddsSource).toBe('sv_odds')
    expect(PROPS[0].consOver).toBe(-110)
    expect(PROPS[0].overBook).toBe('Novig')
    expect(PROPS[0].books).toBe(14)

    expect(BATTERS).toHaveLength(0)
    expect(GOALIES).toHaveLength(0)
    expect(MLB_SLATE.map((g) => g.id)).toEqual(['g1'])
    expect(NHL_SLATE.map((g) => g.id)).toEqual(['g2'])
  })

  it('is idempotent and preserves array identity', () => {
    const ref = PITCHERS
    hydrateLiveData(datasets({ pitchers: [] }))
    expect(PITCHERS).toBe(ref)
    expect(PITCHERS).toHaveLength(0)
    hydrateLiveData(datasets())
    expect(PITCHERS).toHaveLength(1)
  })
})

describe('savant helpers (scale handling)', () => {
  it('formats sv percents as-is (0–100) and rates as 0–1 decimals', () => {
    expect(fmtSvPct(12.5)).toBe('12.5%') // NOT 1250%
    expect(fmtRate(0.345)).toBe('.345')
    expect(fmtRate(1.02)).toBe('1.020')
  })

  it('detects coverage and orders split chips', () => {
    expect(hasSavant(pitcher)).toBe(true)
    expect(hasSavant({})).toBe(false)
    expect(hasSavant(null)).toBe(false)
    const chips = svSplitChips(pitcher.splits)
    expect(chips.map((c) => c.key)).toEqual(['vsL', 'vsR', 'home', 'away'])
    expect(chips.map((c) => c.label)).toEqual(['vs L', 'vs R', 'Home', 'Away'])
    expect(svSplitChips(undefined)).toEqual([])
  })
})

describe('real-odds helpers', () => {
  it('uses consensus for MLB sv rows and best-book tags', () => {
    expect(hasRealOdds(svProp)).toBe(true)
    expect(consensusOver(svProp)).toBe(-110)
    expect(consensusUnder(svProp)).toBe(-110)
    expect(bestOverTag(svProp)).toBe('+108 Novig')
  })

  it('falls back to listed prices for flat (NHL) rows', () => {
    expect(hasRealOdds(nhlProp)).toBe(false)
    expect(consensusOver(nhlProp)).toBe(-115)
    expect(bestOverTag(nhlProp)).toBeNull()
  })
})
