// FIX 10 — make odds staleness visible on the surfaces that serve prices.
//
// The prop board keys on max(sv_odds.game_date) server-side. While the feed
// runs that is today; if the feed ever stops, yesterday's prices serve
// SILENTLY and only pulledAt would betray it. This chip pair renders on
// Edgecenter and Hit Rates:
//   1. always — when the prices were last pulled (pulledAt);
//   2. when max(oddsDate) is not today (ET) — a visible warning naming the
//      date actually being shown.

import { useMemo } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { PROPS } from '@/data/props'
import { etDateString } from '@/lib/slateDay'

export default function OddsFreshness() {
  const { latestPull, oddsDate, today } = useMemo(() => {
    let latestPull: string | null = null
    let oddsDate: string | null = null
    for (const p of PROPS) {
      if (p.oddsSource !== 'sv_odds') continue
      if (p.pulledAt && (!latestPull || p.pulledAt > latestPull)) latestPull = p.pulledAt
      if (p.oddsDate && (!oddsDate || p.oddsDate > oddsDate)) oddsDate = p.oddsDate
    }
    return { latestPull, oddsDate, today: etDateString('today') }
  }, [])

  if (!latestPull) return null
  const stale = oddsDate != null && oddsDate !== today

  return (
    <>
      <span
        className="data-mono flex items-center gap-1.5 rounded-sm border border-line bg-bg-2 px-2 py-1 text-[11px] text-text-3"
        title="When the odds feed last pulled prices from the books"
      >
        <RefreshCw size={11} className="text-sp-cyan" />
        Prices pulled {format(parseISO(latestPull), 'MMM d, h:mm a')}
      </span>
      {stale && (
        <span
          className="data-mono flex items-center gap-1.5 rounded-sm border border-sp-amber/40 bg-sp-amber/10 px-2 py-1 text-[11px] font-semibold text-sp-amber"
          role="alert"
          title="The odds feed has not delivered prices dated today. Everything on this board prices from the date shown — check before acting on it."
        >
          <AlertTriangle size={11} />
          Stale board — prices are for {format(parseISO(`${oddsDate}T12:00:00Z`), 'MMM d')}, not today
        </span>
      )}
    </>
  )
}
