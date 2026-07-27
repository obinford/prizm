// Profiler S3a — Game Logs. The previous table simulated 15 games per player
// from season averages (invented dates, opponents and box scores). It was
// removed in the Phase 1 data-integrity cleanup because none of it was real.
// Real per-game rows exist in the game_logs warehouse table; this panel will
// return once the API route that serves them to the profiler is built.

import { Table2 } from 'lucide-react'
import type { AnyPlayer } from '@/pages/profiler/derive'

export default function GameLogs({ player }: { player: AnyPlayer }) {
  void player
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-bg-1 px-6 py-14 text-center">
      <Table2 size={28} strokeWidth={1.5} className="text-text-3" />
      <p className="text-sm font-medium text-text-2">Game logs were removed.</p>
      <p className="max-w-md text-[13px] leading-relaxed text-text-3">
        The old table generated each game line from season averages — the dates, opponents and
        box scores were simulated, not real. Real per-game logs are stored in the warehouse and
        will return here once the route that serves them is built.
      </p>
    </div>
  )
}
