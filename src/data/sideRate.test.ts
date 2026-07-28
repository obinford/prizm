// Side-aware prop helper tests (Step 12 — Hit Rates parity).
//
// The under side is where dishonesty creeps in: a naive UI shows 1 − over and
// calls it the under rate, which silently counts pushes as under misses.
// These pin the exact derivation from recentValues (same slice, same
// denominator as the server's over rate, pushes excluded from BOTH counts),
// the flagged complement fallback when no per-game log exists, and the
// opponent-tag-based opposing-pitcher lookup.

import { afterEach, describe, expect, it } from 'vitest'
import {
  opposingPitcherHand,
  sideEdgePp,
  sideRate,
  type PropLine,
} from './props'
import { TODAYS_SLATE } from './slate'
import { PITCHERS } from './mlbPlayers'
import type { Pitcher } from './mlbPlayers'

/** Minimal sv_odds-backed prop; only the fields the helpers read. */
const prop = (over: Partial<PropLine>): PropLine =>
  ({
    id: 'p1',
    sport: 'mlb',
    playerId: 'x',
    player: 'Test Player',
    team: 'NYY',
    opponent: 'vs BOS',
    market: 'Hits',
    line: 1,
    overPrice: -110,
    underPrice: -110,
    hitRates: { L5: 0.6, L10: 0.7, L20: 0.65 },
    gameId: 'mlb-bos-nyy',
    oddsSource: 'sv_odds',
    ...over,
  }) as PropLine

describe('sideRate', () => {
  it('over returns the server rate verbatim, not approx', () => {
    const r = sideRate(prop({}), 'L10', 'over')
    expect(r.rate).toBe(0.7)
    expect(r.approx).toBe(false)
  })

  it('under is exact from recentValues — pushes count for NEITHER side', () => {
    // line 1; values: three unders (0), four overs (>1), three pushes (=1).
    const p = prop({
      line: 1,
      recentValues: [2, 0, 1, 3, 1, 0, 2, 1, 4, 0],
      hitRates: { L5: 0.4, L10: 0.4, L20: 0.4 }, // server's over: 4/10
    })
    const under = sideRate(p, 'L10', 'under')
    expect(under.rate).toBeCloseTo(0.3, 10)
    expect(under.approx).toBe(false)
    // The honesty invariant: over + under < 1 because pushes are real.
    expect(sideRate(p, 'L10', 'over').rate + under.rate).toBeCloseTo(0.7, 10)
  })

  it('under respects the window slice, not the full 20-game log', () => {
    // First 5 games all unders; the next 15 all overs.
    const p = prop({
      line: 1.5,
      recentValues: [0, 0, 0, 0, 0, ...Array(15).fill(5)],
    })
    expect(sideRate(p, 'L5', 'under').rate).toBe(1)
    expect(sideRate(p, 'L10', 'under').rate).toBeCloseTo(0.5, 10)
    expect(sideRate(p, 'L20', 'under').rate).toBeCloseTo(0.25, 10)
  })

  it('falls back to 1 − over with the approx flag when no per-game log exists', () => {
    const r = sideRate(prop({ recentValues: undefined }), 'L10', 'under')
    expect(r.rate).toBeCloseTo(0.3, 10)
    expect(r.approx).toBe(true)
  })

  it('falls back (approx) when the log is an empty array', () => {
    const r = sideRate(prop({ recentValues: [] }), 'L10', 'under')
    expect(r.approx).toBe(true)
  })
})

describe('sideEdgePp', () => {
  it('under edge = exact under rate − de-vigged under price', () => {
    // -110/-110 → fair under 0.5. Under hits 6/10 → +10pp.
    const p = prop({
      consOver: -110,
      consUnder: -110,
      line: 1.5,
      recentValues: [0, 0, 0, 0, 0, 0, 5, 5, 5, 5],
    })
    expect(sideEdgePp(p, 'L10', 'under')).toBeCloseTo(10, 5)
  })

  it('is null for flat-priced rows and one-sided consensus', () => {
    expect(sideEdgePp(prop({ oddsSource: 'flat' }), 'L10', 'under')).toBeNull()
    expect(sideEdgePp(prop({ consOver: -110, consUnder: null }), 'L10', 'under')).toBeNull()
  })
})

describe('opposingPitcherHand', () => {
  const slateGame = {
    id: 'mlb-bos-nyy',
    sport: 'mlb' as const,
    away: 'BOS',
    home: 'NYY',
    startTime: '7:05 PM ET',
    venue: 'Yankee Stadium',
    awayProbableId: 'bos-starter',
    homeProbableId: 'nyy-starter',
  }
  const awayArm = { id: 'bos-starter', throws: 'L' } as Pitcher
  const homeArm = { id: 'nyy-starter', throws: 'R' } as Pitcher

  afterEach(() => {
    TODAYS_SLATE.length = 0
    PITCHERS.length = 0
  })

  it('"vs X" (prop team home) → the AWAY probable\'s hand', () => {
    TODAYS_SLATE.push(slateGame)
    PITCHERS.push(awayArm, homeArm)
    expect(opposingPitcherHand(prop({ opponent: 'vs BOS' }))).toBe('L')
  })

  it('"@ X" (prop team away) → the HOME probable\'s hand', () => {
    TODAYS_SLATE.push(slateGame)
    PITCHERS.push(awayArm, homeArm)
    expect(opposingPitcherHand(prop({ opponent: '@ BOS' }))).toBe('R')
  })

  it('null when the game is not on the slate or the probable is unmapped', () => {
    expect(opposingPitcherHand(prop({}))).toBeNull()
    TODAYS_SLATE.push({ ...slateGame, awayProbableId: undefined })
    PITCHERS.push(homeArm)
    expect(opposingPitcherHand(prop({ opponent: 'vs BOS' }))).toBeNull()
  })

  it('null for NHL rows', () => {
    expect(opposingPitcherHand(prop({ sport: 'nhl' }))).toBeNull()
  })
})
