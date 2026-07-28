// Contract-sync guard — Step 9.
//
// src/data/mlbPlayers.ts re-exports the shared player types from
// contracts/prizm.ts. These assertions exist so the hand mirror cannot
// silently grow back: if anyone re-declares one of these types locally and
// it diverges from the contract (a required field either way), this file
// fails `tsc -b`. SlateGame is included because src/data/slate.ts is still
// a hand subset — the assertions pin the direction that must stay true
// (client assignable to contract, and contract assignable to client) so a
// *required*-field drift on either side breaks the build.
//
// Verified 2026-07-27: adding a required field to either side fails tsc
// here; the field was then reverted.

import { describe, expect, it } from 'vitest'
import type {
  Batter,
  BatterWindow,
  MlbWindowKey,
  Pitcher,
  PitcherWindow,
  SavantSplitFields,
  SavantSplitLine,
  SavantSplits,
  SavantWindowFields,
} from './mlbPlayers'
import type { SlateGame } from './slate'
import type * as C from '@contracts/prizm'
import { MLB_WINDOW_KEYS } from './mlbPlayers'
import { MLB_WINDOW_KEYS as CONTRACT_WINDOW_KEYS } from '@contracts/prizm'

type Assignable<A, B> = A extends B ? true : false
type Assert<T extends true> = T

// Bidirectional for the shared player types: they must remain THE SAME
// shape, not merely compatible in one direction.
export type _PlayerTypesStayUnified = Assert<
  Assignable<Pitcher, C.Pitcher> extends true
    ? Assignable<C.Pitcher, Pitcher> extends true
      ? Assignable<Batter, C.Batter> extends true
        ? Assignable<C.Batter, Batter> extends true
          ? Assignable<PitcherWindow, C.PitcherWindow> extends true
            ? Assignable<C.PitcherWindow, PitcherWindow> extends true
              ? Assignable<BatterWindow, C.BatterWindow> extends true
                ? Assignable<C.BatterWindow, BatterWindow> extends true
                  ? Assignable<SavantSplitFields, C.SavantSplitFields> extends true
                    ? Assignable<C.SavantSplitFields, SavantSplitFields> extends true
                      ? Assignable<SavantWindowFields, C.SavantWindowFields> extends true
                        ? Assignable<C.SavantWindowFields, SavantWindowFields> extends true
                          ? Assignable<SavantSplitLine, C.SavantSplitLine> extends true
                            ? Assignable<C.SavantSplitLine, SavantSplitLine> extends true
                              ? Assignable<SavantSplits, C.SavantSplits> extends true
                                ? Assignable<C.SavantSplits, SavantSplits> extends true
                                  ? Assignable<MlbWindowKey, C.MlbWindowKey> extends true
                                    ? Assignable<C.MlbWindowKey, MlbWindowKey>
                                    : false
                                  : false
                                : false
                              : false
                            : false
                          : false
                        : false
                      : false
                    : false
                  : false
                : false
              : false
            : false
          : false
        : false
      : false
    : false
>

// slate.ts is a declared SUBSET (it lacks the optional probable-hand fields
// the server already sends). Optional-field subsets are assignable both
// ways; what must never happen is a required-field divergence.
export type _SlateStaysCompatible = Assert<
  Assignable<SlateGame, C.SlateGame> extends true
    ? Assignable<C.SlateGame, SlateGame>
    : false
>

describe('contract sync', () => {
  it('window keys value-matches the contract', () => {
    expect([...MLB_WINDOW_KEYS]).toEqual([...CONTRACT_WINDOW_KEYS])
  })
})

