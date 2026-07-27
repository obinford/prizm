// Profiler page extras — page hero, empty-section copy, and the followed
// players rail (right-hand column at xl). Types shared with Profiler.tsx.

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { UserCheck } from 'lucide-react'
import { getFollows, onFollowsChange, type FollowEntry } from '@/lib/follows'
import { initials } from '@/pages/profiler/derive'
import type { ProfileTarget } from '@/pages/profiler/ProfileCard'

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

export interface ProfileSection {
  key: string
  label: string
  targets: ProfileTarget[]
}

/** Empty-state copy per grid section (keyed by ProfileSection.key). */
export const SECTION_EMPTY: Record<string, string> = {
  pitchers: 'No starting pitchers match these filters.',
  batters: 'No batters match these filters.',
  goalies: 'No goalies match these filters.',
  skaters: 'No skaters match these filters.',
}

/** Count followed players per sport — used by the FollowedRail header. */
export function typeCounts(follows: FollowEntry[]): { mlb: number; nhl: number } {
  return {
    mlb: follows.filter((f) => f.sport === 'mlb').length,
    nhl: follows.filter((f) => f.sport === 'nhl').length,
  }
}

/** Page hero band — overline, headline, one-line pitch. */
export function ProfilerHero() {
  return (
    <div className="pt-2">
      <div className="inline-block">
        <span className="overline-caption text-sp-indigo">Profiler</span>
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mt-2 h-px origin-left opacity-60"
          style={{ background: 'var(--gradient-spectrum)' }}
        />
      </div>
      <h1 className="mt-4 font-display text-[30px] font-bold leading-[1.08] tracking-[-0.02em] text-text-1 md:text-[38px]">
        Every side of <span className="text-spectrum">one player.</span>
      </h1>
      <p className="mt-3 max-w-xl text-[15px] leading-[1.65] text-text-2">
        Game logs, rolling splits, batted-ball profile and news — open any card
        for the full drawer.
      </p>
    </div>
  )
}

/**
 * Fixed right rail (xl+) listing followed players. The main column reserves
 * room with xl:pr-[300px]; below xl the rail is hidden.
 */
export function FollowedRail() {
  const [follows, setFollows] = useState<FollowEntry[]>(() => getFollows())
  useEffect(() => onFollowsChange(() => setFollows(getFollows())), [])

  const counts = typeCounts(follows)

  return (
    <aside
      className="fixed bottom-0 right-0 top-[72px] hidden w-[300px] border-l border-line bg-bg-0 xl:block"
      aria-label="Followed players"
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <UserCheck size={15} strokeWidth={1.5} className="text-sp-indigo" />
            <h2 className="font-display text-sm font-semibold text-text-1">Following</h2>
            <span className="data-mono rounded-sm bg-bg-2 px-1.5 py-0.5 text-[10px] text-text-3">
              {follows.length}
            </span>
          </div>
          {follows.length > 0 && (
            <p className="data-mono mt-1.5 text-[10px] uppercase tracking-wider text-text-3">
              {counts.mlb} MLB · {counts.nhl} NHL
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {follows.length === 0 ? (
            <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-[12px] leading-relaxed text-text-3">
              Follow players from the grid and they show up here — and in
              EdgeCenter.
            </p>
          ) : (
            <ul className="space-y-1">
              {follows.map((f, i) => (
                <motion.li
                  key={f.playerId}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3), ease: EASE }}
                  className="flex items-center gap-3 rounded-md px-2 py-2"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-text-1"
                    style={{
                      background:
                        'linear-gradient(var(--bg-3), var(--bg-3)) padding-box, var(--gradient-spectrum) border-box',
                      border: '1.5px solid transparent',
                    }}
                    aria-hidden
                  >
                    {initials(f.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-text-1">
                      {f.name}
                    </span>
                    <span className="data-mono block text-[10px] text-text-3">
                      {f.team} · {f.role} · {f.sport.toUpperCase()}
                    </span>
                  </span>
                </motion.li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-line px-5 py-3">
          <Link
            to="/edgecenter"
            className="data-mono text-[11px] font-semibold text-sp-indigo transition-colors hover:brightness-125"
          >
            Open EdgeCenter →
          </Link>
        </div>
      </div>
    </aside>
  )
}
