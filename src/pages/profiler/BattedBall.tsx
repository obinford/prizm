// Profiler S3c — Batted Ball / Shot Profile. The previous chart drew a
// 15-game Hard-Hit% series and a Pull/Center/Oppo spray mix, both generated
// from a name hash. It was removed in the Phase 1 data-integrity cleanup:
// the warehouse stores a season-level hard-hit rate but no per-game series
// and no spray mix, so there was nothing real to plot.

import { ChartLine } from 'lucide-react'
import type { AnyPlayer } from '@/pages/profiler/derive'

export default function BattedBall({ player }: { player: AnyPlayer }) {
  void player
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-bg-1 px-6 py-14 text-center">
      <ChartLine size={28} strokeWidth={1.5} className="text-text-3" />
      <p className="text-sm font-medium text-text-2">The batted-ball / shot-profile chart was removed.</p>
      <p className="max-w-md text-[13px] leading-relaxed text-text-3">
        The rolling rate series and the spray mix were generated, not measured — no per-game
        hard-hit series or spray data exists in any connected source. It will come back if a
        real feed for it is added.
      </p>
    </div>
  )
}
