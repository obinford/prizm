// De-vig + Wilson CI contract tests.
//
// This is math whose errors are invisible in the UI — a wrong normalisation
// still renders a plausible-looking number on every row. These pin the method
// (multiplicative), the null semantics (one-sided is not a de-vig), and the
// interval behaviour at the boundaries where prop hit rates actually live.

import { describe, expect, it } from 'vitest'
import {
  ciWilson,
  devig,
  devigProp,
  edgePp,
  edgeQuality,
  edgeSurvivesCI,
  impliedProb,
  windowN,
  type PropLine,
} from './props'

/** Minimal sv_odds-backed prop; only the fields the math reads. */
const prop = (over: Partial<PropLine>): PropLine =>
  ({
    id: 'p1',
    sport: 'mlb',
    playerId: 'x',
    player: 'Test Player',
    team: 'NYY',
    opponent: 'BOS',
    market: 'Hits',
    line: 0.5,
    overPrice: -110,
    underPrice: -110,
    hitRates: { L5: 0.6, L10: 0.7, L20: 0.65 },
    gameId: 'g1',
    oddsSource: 'sv_odds',
    ...over,
  }) as PropLine

describe('devig', () => {
  it('two -110 prices → hold ≈ 0.0476, both sides ≈ 0.500 exactly', () => {
    const d = devig(-110, -110)
    expect(d).not.toBeNull()
    expect(d!.hold).toBeCloseTo(0.0476, 3)
    expect(d!.over).toBeCloseTo(0.5, 10)
    expect(d!.under).toBeCloseTo(0.5, 10)
  })

  it('a +100 / -120 pair → sides sum to exactly 1.0 after de-vig', () => {
    const d = devig(100, -120)
    expect(d).not.toBeNull()
    expect(d!.over + d!.under).toBeCloseTo(1.0, 10)
  })

  it('de-vigged over is always strictly less than raw implied over, for any positive hold', () => {
    const pairs: [number, number][] = [
      [-110, -110],
      [100, -120],
      [-150, 130],
      [-250, 200],
      [-105, -115],
    ]
    for (const [o, u] of pairs) {
      const d = devig(o, u)!
      expect(d.hold).toBeGreaterThan(0)
      expect(d.over).toBeLessThan(impliedProb(o))
    }
  })

  it('returns null when either side is missing — a one-sided de-vig is not a de-vig', () => {
    expect(devig(-110, null)).toBeNull()
    expect(devig(null, -110)).toBeNull()
    expect(devig(null, null)).toBeNull()
  })
})

describe('ciWilson', () => {
  it('n=10 is materially wider than n=100; both contain the rate', () => {
    const [lo10, hi10] = ciWilson(0.7, 10)
    const [lo100, hi100] = ciWilson(0.7, 100)
    expect(hi10 - lo10).toBeGreaterThan((hi100 - lo100) * 2)
    expect(lo10).toBeLessThan(0.7)
    expect(hi10).toBeGreaterThan(0.7)
    expect(lo100).toBeLessThan(0.7)
    expect(hi100).toBeGreaterThan(0.7)
  })

  it('ciWilson(1.0, 5) → upper bound exactly 1, lower below 1, no NaN', () => {
    const [lo, hi] = ciWilson(1.0, 5)
    expect(hi).toBe(1)
    expect(lo).toBeLessThan(1)
    expect(lo).toBeGreaterThan(0)
    expect(Number.isNaN(lo)).toBe(false)
  })

  it('ciWilson(0, 5) → lower bound exactly 0', () => {
    const [lo] = ciWilson(0, 5)
    expect(lo).toBe(0)
  })
})

describe('edgeSurvivesCI', () => {
  // A 7/10 hit rate against a 0.60 fair price does NOT survive: Wilson(0.7,
  // n=10) lower bound ≈ 0.397 < 0.60. The same 70% rate over n=100 has a
  // lower bound ≈ 0.604 > 0.60. That sample-size distinction is the whole
  // point of the function.
  //
  // NOTE: HitWindow maxes at L20, so the n=100 case is not reachable through
  // edgeSurvivesCI's public signature (windowN caps at 20). It is verified at
  // the ciWilson level here, and edgeSurvivesCI's true branch is proven with
  // a rate whose L20 interval does clear the price. If a larger window is
  // ever added, this test should exercise both branches through the public
  // function.
  it('is false for a 7/10 rate against a 0.60 fair price', () => {
    // fair over ≈ 0.6003: raw 205/305 = 0.67213 and 81/181 = 0.44751, sum
    // 1.11964. Assert against devigProp's own output rather than a hardcoded
    // 0.60 — integer American prices cannot express fair 0.60 exactly.
    const p = prop({ consOver: -205, consUnder: -81, hitRates: { L5: 0.6, L10: 0.7, L20: 0.65 } })
    const fair = devigProp(p)!
    expect(fair.over).toBeCloseTo(0.6, 2)
    expect(edgeSurvivesCI(p, 'L10')).toBe(false)
  })

  it('70% over n=100 clears the same price — verified at the interval level', () => {
    const [lo] = ciWilson(0.7, 100)
    expect(lo).toBeGreaterThan(0.6)
  })

  it('returns true when the L20 lower bound clears the fair price', () => {
    const p = prop({
      consOver: -205,
      consUnder: -81,
      hitRates: { L5: 0.9, L10: 0.9, L20: 0.95 },
    })
    expect(edgeSurvivesCI(p, 'L20')).toBe(true)
  })

  it('returns null without two-sided odds', () => {
    expect(edgeSurvivesCI(prop({ oddsSource: 'flat' }))).toBeNull()
    expect(edgeSurvivesCI(prop({ consOver: -110, consUnder: null }))).toBeNull()
  })
})

describe('edgePp / windowN', () => {
  it('edge = hit rate − de-vigged over, in percentage points', () => {
    const p = prop({ consOver: -110, consUnder: -110, hitRates: { L5: 0.6, L10: 0.7, L20: 0.65 } })
    expect(edgePp(p, 'L10')).toBeCloseTo(20, 5) // 0.70 − 0.50
  })

  it('is null for flat-priced (NHL) rows and one-sided consensus', () => {
    expect(edgePp(prop({ oddsSource: 'flat' }))).toBeNull()
    expect(edgePp(prop({ consOver: -110, consUnder: null }))).toBeNull()
  })

  it('windowN parses the window digit run', () => {
    expect(windowN('L5')).toBe(5)
    expect(windowN('L10')).toBe(10)
    expect(windowN('L20')).toBe(20)
  })
})

describe('edgeQuality', () => {
  const q = (consOver: number, consUnder: number, books: number | null) =>
    prop({ consOver, consUnder, books, hitRates: { L5: 0.8, L10: 0.8, L20: 0.8 } })

  it('accepts a normal market', () => {
    expect(edgeQuality(q(-110, -110, 12)).ok).toBe(true)
  })

  it('rejects a thin consensus and says how thin', () => {
    const r = edgeQuality(q(-110, -110, 2))
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('2 books')
  })

  it('rejects an incoherent hold and names it', () => {
    // -400/-400 implies 0.80 + 0.80 = 1.60 -> 60% hold.
    const r = edgeQuality(q(-400, -400, 12))
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('hold')
  })

  it('gates the CI survivor mark, not just the display', () => {
    // Same 80% hit rate, same -110/-110 market (fair 0.500), same window.
    // L20 is used because at L10 even 80% does not clear 0.500 — Wilson lower
    // bound is 0.490. That near-miss is the sample-size lesson this whole
    // feature exists to make visible, so it gets its own case below.
    expect(edgeSurvivesCI(q(-110, -110, 12), 'L20')).toBe(true)
    expect(edgeSurvivesCI(q(-110, -110, 2), 'L20')).toBe(false)
  })

  it('an 80% hit rate over 10 games does NOT clear an even-money fair price', () => {
    // 8/10 feels like a lock and is not one: Wilson lo = 0.490 < 0.500.
    expect(edgeSurvivesCI(q(-110, -110, 12), 'L10')).toBe(false)
  })

  it('leaves a row with no real odds as null, not false', () => {
    expect(edgeSurvivesCI(prop({ oddsSource: 'flat' }))).toBe(null)
  })
})
