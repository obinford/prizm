// FIX 19 — the game-odds block for Gamecenter (card + detail).
//
// Moneyline (both sides), runline (line + both prices), total (line + O/U
// prices), and the book hold on the moneyline via the same two-sided
// multiplicative devig() the prop board uses. Prices are cross-book means
// from The Odds API `us` region (server: api/odds/gameOdds.ts).
//
// Every field is null when the join missed or no key is configured — this
// component renders ONE honest em-dash chip with the reason on hover, never
// a partial guess. (A joined game with a genuinely missing market shows
// that market as — within the row; that is provider reality, not a bug.)

import type { SlateGame } from '@/data/slate'
import { devig, formatOdds } from '@/data/props'

const MISSING_HINT =
  'No game odds for this matchup — The Odds API had no joinable event for this pair and date (or the game-odds feed is not configured server-side). Prizm never invents a price.'

function Chip({ label, title }: { label: string; title?: string }) {
  return (
    <span
      className="data-mono rounded-sm border border-line bg-bg-2 px-2.5 py-1.5 text-[12px] text-text-2"
      title={title}
    >
      {label}
    </span>
  )
}

export default function GameOdds({ game }: { game: SlateGame }) {
  const mlA = game.moneylineAway ?? null
  const mlH = game.moneylineHome ?? null
  const rl = game.runline ?? null
  const rlA = game.runlineAwayPrice ?? null
  const rlH = game.runlineHomePrice ?? null
  const tot = game.total ?? null
  const oP = game.totalOverPrice ?? null
  const uP = game.totalUnderPrice ?? null

  const allNull = [mlA, mlH, rl, rlA, rlH, tot, oP, uP].every((v) => v == null)
  if (allNull) {
    return <Chip label="Game odds —" title={MISSING_HINT} />
  }

  // Hold on the moneyline — same normalization as the prop board.
  const dv = devig(mlA, mlH)

  // Away runline point is the negation of the home point.
  const rlAwayPoint = rl != null ? -rl : null
  const fmtPoint = (p: number) => (p > 0 ? `+${p.toFixed(1)}` : p.toFixed(1))

  return (
    <>
      <Chip
        label={
          mlA != null || mlH != null
            ? `ML ${game.away} ${mlA != null ? formatOdds(mlA) : '—'} · ${game.home} ${
                mlH != null ? formatOdds(mlH) : '—'
              }`
            : 'ML —'
        }
        title="Moneyline, cross-book mean (The Odds API, us region)"
      />
      <Chip
        label={
          rl != null
            ? `RL ${game.away} ${rlAwayPoint != null ? fmtPoint(rlAwayPoint) : '—'} (${
                rlA != null ? formatOdds(rlA) : '—'
              }) · ${game.home} ${fmtPoint(rl)} (${rlH != null ? formatOdds(rlH) : '—'})`
            : 'RL —'
        }
        title="Runline with both prices, cross-book mean"
      />
      <Chip
        label={
          tot != null
            ? `O/U ${tot.toFixed(1)} (O ${oP != null ? formatOdds(oP) : '—'} · U ${
                uP != null ? formatOdds(uP) : '—'
              })`
            : 'O/U —'
        }
        title="Game total with over/under prices, cross-book mean"
      />
      {dv && (
        <Chip
          label={`hold ${(dv.hold * 100).toFixed(1)}%`}
          title="Book margin on the moneyline — two-sided multiplicative de-vig, same normalization as the prop board"
        />
      )}
    </>
  )
}
