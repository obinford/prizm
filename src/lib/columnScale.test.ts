// Scale-contract guard.
//
// sv_stat_cache percent fields are 0–100; legacy MySQL kPct/bbPct are 0–1.
// The formatter choice ENCODES that scale: fmt.svPct means the raw value is
// 0–100, fmt.pct1 means 0–1. Filter rules compare against the raw value, so a
// saved rule like `kPct > 25` silently changes meaning if either side is ever
// renormalised without the formatter changing with it.
//
// THIS TEST FAILING MEANS SAVED USER RULES ARE ABOUT TO SILENTLY CHANGE
// MEANING. Changing a data scale requires changing the formatter, and that
// pair must change together, deliberately, with a migration note for saved
// views — never as a side effect of another edit.
//
// It does not fix the inconsistency; it makes breaking it loud. Normalising
// the two scales is a separate task with a migration cost for saved rules.

import { describe, expect, it } from 'vitest'
import { fmt } from './columns'
import type { ColumnDef } from './columns'
import { BATTER_COLUMNS } from './columns/mlbBatters'
import { PITCHER_COLUMNS } from './columns/mlbPitchers'
import { BULLPEN_COLUMNS } from './columns/mlbBullpen'
import { teamColumns } from './columns/mlbTeams'

/** Reverse-lookup a formatter's name in fmt, for readable failures. */
const fmtName = (f: ((v: number) => string) | undefined): string =>
  f == null ? 'none' : (Object.entries(fmt).find(([, v]) => v === f)?.[0] ?? 'UNKNOWN')

const SURFACES: Record<string, ColumnDef<any>[]> = {
  batters: BATTER_COLUMNS,
  pitchers: PITCHER_COLUMNS,
  bullpen: BULLPEN_COLUMNS,
  teams: teamColumns({}),
}

/**
 * The pinned pairing, generated from the production column lists on
 * 2026-07-27 and reviewed by hand. A diff here is never "just a format
 * tweak" — read the header comment before changing it.
 */
const EXPECTED: Record<string, Record<string, string>> = {
  batters: {
    team: 'none', pos: 'none', bats: 'none', oppHand: 'none',
    avg: 'rate', obp: 'rate', slg: 'rate', ops: 'rate', iso: 'rate',
    xbh: 'dec2', tb: 'dec2',
    xwoba: 'rate', woba: 'rate', xba: 'rate', xslg: 'rate', babip: 'rate',
    barrelPct: 'svPct', hardHitPct: 'svPct', avgEv: 'ev',
    whiffPct: 'svPct', swStrPct: 'svPct', cswPct: 'svPct', zonePct: 'svPct',
    gbPct: 'svPct', fbPct: 'svPct', ldPct: 'svPct', hrPct: 'svPct',
    bbe: 'int',
  },
  pitchers: {
    team: 'none', throws: 'none', opponent: 'none',
    era: 'era', whip: 'whip', kPct: 'pct1', bbPct: 'pct1', xwoba: 'rate',
    kbbPct: 'pct1',
    cswPct: 'svPct', swStrPct: 'svPct', whiffPct: 'svPct', zonePct: 'svPct',
    barrelPct: 'svPct', hardHitPct: 'svPct', avgEv: 'ev',
    gbPct: 'svPct', fbPct: 'svPct', ldPct: 'svPct',
    xba: 'rate', xslg: 'rate', woba: 'rate', babip: 'rate', iso: 'rate', slg: 'rate',
    bbe: 'int',
  },
  bullpen: {
    team: 'none', era: 'era', whip: 'whip',
    kPct: 'pct1', bbPct: 'pct1', // 0–1 legacy aggregate — NOT svPct
    relievers: 'int',
  },
  teams: {
    team: 'none', batters: 'int', teamPa: 'int',
    woba: 'rate', xwoba: 'rate', avg: 'rate', slg: 'rate', iso: 'rate', babip: 'rate',
    hrPct: 'svPct', xba: 'rate', xslg: 'rate',
    kPct: 'svPct', bbPct: 'svPct', // 0–100 sv-native — NOT pct1
    swStrPct: 'svPct', cswPct: 'svPct', whiffPct: 'svPct', zonePct: 'svPct',
    hardHitPct: 'svPct', barrelPct: 'svPct', avgEv: 'dec1',
    gbPct: 'svPct', fbPct: 'svPct', ldPct: 'svPct', gbFb: 'dec2',
  },
}

describe('column scale contract', () => {
  for (const [surface, columns] of Object.entries(SURFACES)) {
    it(`${surface}: every column's formatter matches the pinned scale`, () => {
      const expected = EXPECTED[surface]
      const actual: Record<string, string> = {}
      for (const c of columns) actual[c.key] = fmtName(c.format)
      expect(actual).toEqual(expected)
    })
  }

  // The trap, named explicitly: the same key lives on two surfaces with two
  // different scales. A find-and-replace across column files breaks this.
  it('bullpen kPct/bbPct are 0–1 (fmt.pct1)', () => {
    for (const c of BULLPEN_COLUMNS) {
      if (c.key === 'kPct' || c.key === 'bbPct') expect(c.format).toBe(fmt.pct1)
    }
  })

  it('team kPct/bbPct are 0–100 (fmt.svPct)', () => {
    for (const c of teamColumns({})) {
      if (c.key === 'kPct' || c.key === 'bbPct') expect(c.format).toBe(fmt.svPct)
    }
  })

  it('pitcher kPct/bbPct/kbbPct are 0–1 (fmt.pct1)', () => {
    for (const c of PITCHER_COLUMNS) {
      if (['kPct', 'bbPct', 'kbbPct'].includes(c.key)) expect(c.format).toBe(fmt.pct1)
    }
  })
})
