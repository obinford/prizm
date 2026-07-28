// Batting-order resolution contract tests — the client half of the join.
// A feed player Prizm does not list, and a Prizm batter the feed does not
// name, must both resolve to a dash, never a crash and never a guess.

import { describe, expect, it } from 'vitest'
import { ORDER_MISSING_HINTS, resolveBattingOrder } from './lineups'

const slugs = {
  'tarik-skubal': { battingOrder: 1, position: 'P' },
  'joe-hitter': { battingOrder: 4, position: 'LF' },
}

describe('resolveBattingOrder', () => {
  it('maps a known lineup entry to the right batter', () => {
    expect(resolveBattingOrder(slugs, 'joe-hitter', true)).toEqual({ order: 4, state: 'posted' })
  })

  it('a player in the feed but not in Prizm’s list is skipped, not crashed on', () => {
    expect(resolveBattingOrder(slugs, 'someone-else', true)).toEqual({ order: null, state: 'posted' })
  })

  it('an unposted game resolves to the not-posted state with no order', () => {
    expect(resolveBattingOrder(slugs, 'joe-hitter', false)).toEqual({
      order: null,
      state: 'not-posted',
    })
  })

  it('a missing slugs map is safe', () => {
    expect(resolveBattingOrder(undefined, 'joe-hitter', true)).toEqual({ order: null, state: 'posted' })
  })
})

describe('ORDER_MISSING_HINTS', () => {
  it('distinguishes all three states — collapsing them is the lie', () => {
    expect(ORDER_MISSING_HINTS.posted).toContain('Not in tonight')
    expect(ORDER_MISSING_HINTS['not-posted']).toContain('not posted yet')
    expect(ORDER_MISSING_HINTS['no-game']).toContain('No game')
  })
})
