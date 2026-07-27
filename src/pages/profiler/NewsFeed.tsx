// Profiler S3d — News timeline. The previous feed rendered hand-written
// sample blurbs, each stamped with a fixed "1h ago" string, and presented
// them as live news. It was removed in the Phase 1 data-integrity cleanup.
// This panel returns when a real news source is connected.

import { Newspaper } from 'lucide-react'
import type { AnyPlayer } from '@/pages/profiler/derive'

export default function NewsFeed({ player }: { player: AnyPlayer }) {
  void player
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-bg-1 px-6 py-14 text-center">
      <Newspaper size={28} strokeWidth={1.5} className="text-text-3" />
      <p className="text-sm font-medium text-text-2">The news feed was removed.</p>
      <p className="max-w-md text-[13px] leading-relaxed text-text-3">
        The items here were hand-written samples with fixed timestamps, not live news. The feed
        will return once a real news source is connected.
      </p>
    </div>
  )
}
