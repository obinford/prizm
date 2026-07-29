// Profiler grid card — one player, preview stats, follow + open affordances.
// Opens the detail drawer (Drawer.tsx) via onOpen.

import { motion } from 'framer-motion'
import { Flame, UserCheck, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isFollowed, onFollowsChange } from '@/lib/follows'
import {
  formScore,
  headerStats,
  initials,
  posLabel,
  type AnyPlayer,
} from '@/pages/profiler/derive'

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

export type ProfileKind = 'pitcher' | 'batter' | 'goalie' | 'skater'

export interface ProfileTarget {
  kind: ProfileKind
  player: AnyPlayer
}

interface Props {
  target: ProfileTarget
  index: number
  onFollow: () => void
  onOpen: () => void
}

export default function ProfileCard({ target, index, onFollow, onOpen }: Props) {
  const { player } = target
  const score = formScore(player)
  const stats = headerStats(player).slice(0, 4)
  const [followed, setFollowed] = useState(() => isFollowed(player.id))
  useEffect(() => onFollowsChange(() => setFollowed(isFollowed(player.id))), [player.id])

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4), ease: EASE }}
      className="group relative flex flex-col rounded-lg border border-line bg-bg-1 p-5 transition-colors hover:border-line-strong"
      aria-label={`${player.name} profile card`}
    >
      {/* Identity */}
      <div className="flex items-center gap-3.5">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-text-1"
          style={{
            background:
              'linear-gradient(var(--bg-2), var(--bg-2)) padding-box, var(--gradient-spectrum) border-box',
            border: '2px solid transparent',
          }}
          aria-hidden
        >
          {initials(player.name)}
        </span>
        <div className="min-w-0">
          <h4 className="truncate text-[15px] font-semibold text-text-1">{player.name}</h4>
          <p className="data-mono mt-0.5 text-[11px] text-text-3">
            {player.team} · {posLabel(player)} · {player.sport.toUpperCase()}
          </p>
        </div>
        {score >= 75 && (
          <span
            className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-warning"
            title={`Form score ${score}/100`}
          >
            <Flame size={12} strokeWidth={1.5} /> Hot
          </span>
        )}
      </div>

      {/* Stat preview — first four header stats, no invention */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-sm bg-bg-2 px-2 py-2 text-center">
            <p className="data-mono truncate text-[13px] font-semibold text-text-1">{s.value}</p>
            <p className="data-mono mt-0.5 text-[9px] uppercase tracking-wider text-text-3">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="flex-1 rounded-md border border-line bg-bg-2 px-3 py-2 text-xs font-semibold text-text-1 transition-colors hover:border-sp-indigo/50 hover:bg-bg-3"
        >
          Open profile
        </button>
        <button
          type="button"
          onClick={onFollow}
          aria-label={followed ? `Unfollow ${player.name}` : `Follow ${player.name}`}
          title={followed ? 'Following' : 'Follow'}
          className={`rounded-md border p-2 transition-colors ${
            followed
              ? 'border-sp-indigo/50 bg-sp-indigo/15 text-sp-indigo'
              : 'border-line bg-bg-2 text-text-2 hover:bg-bg-3 hover:text-text-1'
          }`}
        >
          {followed ? <UserCheck size={14} /> : <UserPlus size={14} />}
        </button>
      </div>
    </motion.article>
  )
}
