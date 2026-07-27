// Profiler S2 — player header card: avatar + identity, season stat grid (2×4),
// form gauge with spectrum ring, Follow / Add-to-angle / Share actions.

import { useEffect, useState } from 'react'
import { animate, motion } from 'framer-motion'
import { BookmarkPlus, Flame, Link2, UserPlus, UserCheck } from 'lucide-react'
import {
  formScore,
  handLabel,
  headerStats,
  initials,
  posLabel,
  type AnyPlayer,
} from '@/pages/profiler/derive'
import { isFollowed, onFollowsChange, toggleFollow } from '@/lib/follows'

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

/** Numeric count-up 0 → value (800ms) for mono stat numerals. */
function CountUp({ text, delay }: { text: string; delay: number }) {
  const match = text.match(/-?[\d.]+/)
  const [display, setDisplay] = useState(text)
  useEffect(() => {
    if (!match) {
      setDisplay(text)
      return
    }
    const target = parseFloat(match[0])
    const decimals = match[0].includes('.') ? match[0].split('.')[1].length : 0
    const controls = animate(0, target, {
      duration: 0.8,
      delay,
      ease: EASE,
      onUpdate: (v) => setDisplay(text.replace(match[0], v.toFixed(decimals))),
    })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])
  return <>{display}</>
}

/** Circular form gauge (80px) with spectrum gradient ring sweep. */
function FormGauge({ score }: { score: number }) {
  const R = 34
  const C = 2 * Math.PI * R
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const controls = animate(0, score, {
      duration: 0.9,
      ease: EASE,
      onUpdate: (v) => setShown(Math.round(v)),
    })
    return () => controls.stop()
  }, [score])
  return (
    <div className="relative h-20 w-20">
      <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
        <defs>
          <linearGradient id="form-gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="35%" stopColor="#22D3EE" />
            <stop offset="65%" stopColor="#A3E635" />
            <stop offset="100%" stopColor="#F472B6" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r={R} fill="none" stroke="var(--bg-3)" strokeWidth="6" />
        <motion.circle
          cx="40"
          cy="40"
          r={R}
          fill="none"
          stroke="url(#form-gauge-gradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - score / 100) }}
          transition={{ duration: 0.9, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="data-mono text-xl font-bold text-text-1">{shown}</span>
      </div>
    </div>
  )
}

interface Props {
  player: AnyPlayer
  onAddToAngle: () => void
  onToast: (msg: string) => void
}

export default function PlayerHeader({ player, onAddToAngle, onToast }: Props) {
  const score = formScore(player)
  const stats = headerStats(player)
  const [followed, setFollowed] = useState(() => isFollowed(player.id))
  useEffect(() => onFollowsChange(() => setFollowed(isFollowed(player.id))), [player.id])

  const onToggleFollow = () => {
    const nowFollowing = toggleFollow({
      id: player.id,
      sport: player.sport,
      name: player.name,
      team: player.team,
      role: posLabel(player),
    })
    setFollowed(nowFollowing)
    onToast(nowFollowing ? 'Following — appears in EdgeCenter' : 'Unfollowed')
  }

  const share = async () => {
    const url = `${window.location.origin}/profiler?player=${player.id}`
    try {
      await navigator.clipboard.writeText(url)
      onToast('Profiler link copied')
    } catch {
      onToast(url)
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="prizm-card !rounded-xl p-6"
      aria-label={`${player.name} profile header`}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
        {/* Left — identity */}
        <div className="flex items-center gap-5 lg:w-[320px] lg:shrink-0">
          <span
            className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full font-display text-2xl font-bold text-text-1"
            style={{
              background:
                'linear-gradient(var(--bg-2), var(--bg-2)) padding-box, var(--gradient-spectrum) border-box',
              border: '3px solid transparent',
            }}
            aria-hidden
          >
            {initials(player.name)}
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-display text-[26px] font-bold leading-tight text-text-1 md:text-[30px]">
              {player.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded-sm bg-bg-3 px-2 py-0.5 text-[11px] font-semibold text-text-1">
                {player.team}
              </span>
              <span className="rounded-sm bg-bg-3 px-2 py-0.5 text-[11px] font-semibold text-text-1">
                {posLabel(player)}
              </span>
              <span className="rounded-sm bg-bg-3 px-2 py-0.5 text-[11px] font-semibold text-text-2">
                {handLabel(player)}
              </span>
            </div>
          </div>
        </div>

        {/* Center — season stat grid 2×4 */}
        <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label}>
              <p className="data-mono text-xl font-bold text-text-1">
                <CountUp text={s.value} delay={0.1 + i * 0.04} />
              </p>
              <p className="data-mono mt-1 text-[11px] uppercase tracking-wider text-text-3">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Right — form gauge + actions */}
        <div className="flex items-center gap-5 lg:w-[220px] lg:shrink-0 lg:flex-col lg:items-end">
          <div className="flex items-center gap-3">
            <FormGauge score={score} />
            <div>
              <p className="overline-caption text-text-3">Form</p>
              {score >= 75 && (
                <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-warning">
                  <Flame size={12} strokeWidth={1.5} /> Hot
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleFollow}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
                followed
                  ? 'border-sp-indigo/50 bg-sp-indigo/15 text-sp-indigo'
                  : 'border-line bg-bg-2 text-text-1 hover:bg-bg-3'
              }`}
            >
              {followed ? <UserCheck size={14} /> : <UserPlus size={14} />}
              {followed ? 'Following' : 'Follow'}
            </button>
            <button
              type="button"
              onClick={onAddToAngle}
              title="Add to My Angles"
              className="flex items-center gap-1.5 rounded-md border border-line bg-bg-2 px-3 py-2 text-xs font-semibold text-text-1 transition-colors hover:bg-bg-3"
            >
              <BookmarkPlus size={14} /> Angle
            </button>
            <button
              type="button"
              onClick={share}
              title="Copy profiler link"
              aria-label="Copy profiler link"
              className="rounded-md border border-line bg-bg-2 p-2 text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
            >
              <Link2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  )
}
