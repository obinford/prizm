// FIX 19 — provenance + quota line for The Odds API game odds, rendered in
// the Gamecenter header. Same honesty contract as OddsFreshness (FIX 10):
// when the last pull failed or was rate-limited, the degraded state is
// VISIBLE; failed joins are named on hover, never silent.

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { trpc } from '@/providers/trpc'

export default function GameOddsFreshness() {
  const q = trpc.slate.gameOddsStatus.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: 1,
  })
  if (!q.data) return null
  const p = q.data

  if (!p.configured) {
    return (
      <span
        className="data-mono flex items-center gap-1.5 rounded-sm border border-line bg-bg-2 px-2 py-1 text-[11px] text-text-3"
        title="The game-odds feed is not configured server-side — moneyline/runline/total dash out. Player props are unaffected (sv_odds)."
      >
        Game odds not configured
      </span>
    )
  }

  const title = [
    `The Odds API · ${p.priced}/${p.total} games priced · ${p.regions} · ${
      p.pulledAt ? `pulled ${format(parseISO(p.pulledAt), 'MMM d, h:mm a')}` : 'not pulled yet'
    }${p.remaining != null ? ` · ${p.remaining} requests left` : ''}`,
    p.markets ? `markets: ${p.markets.join(', ')}` : '',
    p.misses.length ? `misses: ${p.misses.join('; ')}` : '',
    p.doubleheaders ? `${p.doubleheaders} doubleheader game(s) matched by start time` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <>
      <span
        className="data-mono flex items-center gap-1.5 rounded-sm border border-line bg-bg-2 px-2 py-1 text-[11px] text-text-3"
        title={title}
      >
        <RefreshCw size={11} className="text-sp-cyan" />
        Game odds {p.priced}/{p.total} priced
        {p.remaining != null ? ` · ${p.remaining} left` : ''}
      </span>
      {p.degraded && (
        <span
          className="data-mono flex items-center gap-1.5 rounded-sm border border-sp-amber/40 bg-sp-amber/10 px-2 py-1 text-[11px] font-semibold text-sp-amber"
          role="alert"
          title="The last odds pull failed or was rate-limited (429). Serving the previous pull or dashes — no tight retries, the next scheduled pull recovers."
        >
          <AlertTriangle size={11} />
          Game odds degraded
        </span>
      )}
    </>
  )
}
