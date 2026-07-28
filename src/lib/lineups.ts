// Client-side resolution of tonight's batting order for one batter row.
//
// The three states are genuinely different and must never collapse into one:
//   posted     → the game's lineup is out; this batter is or isn't in it
//   not-posted → the game has no lineup yet (normal until ~3–4h before first pitch)
//   no-game    → the batter is not on tonight's slate at all

export type LineupState = 'posted' | 'not-posted' | 'no-game'

export interface OrderEntry {
  battingOrder: number
  position: string
}

export function resolveBattingOrder(
  slugs: Record<string, OrderEntry> | undefined,
  batterId: string,
  posted: boolean,
): { order: number | null; state: LineupState } {
  if (!posted) return { order: null, state: 'not-posted' }
  // A player in Prizm's list but not the feed (or vice versa) is skipped —
  // never crashed on, never guessed.
  const entry = slugs?.[batterId]
  return { order: entry?.battingOrder ?? null, state: 'posted' }
}

/** The dash tooltip per state. Consumed by the Ord column's missingHintFor. */
export const ORDER_MISSING_HINTS: Record<LineupState, string> = {
  posted: 'Not in tonight’s posted lineup.',
  'not-posted': 'Lineup not posted yet — MLB teams typically release 3–4 hours before first pitch.',
  'no-game': 'No game on this slate.',
}
