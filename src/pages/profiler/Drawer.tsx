// Profiler player detail drawer — right-hand slide-over composing the eight
// profiler sections: PlayerSearch (switch player), PlayerHeader, StatcastStrip,
// GameLogs, Splits, BattedBall, NewsFeed, ContextRail.
//
// Player switching (ContextRail "Similar profiles", top-bar search) is handled
// internally so the parent grid doesn't remount; the drawer is keyed by the
// opening player id in Profiler.tsx.

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, UserCheck, UserPlus, X } from 'lucide-react'
import { isFollowed, onFollowsChange } from '@/lib/follows'
import { addAngle, playerSnapshot } from '@/pages/angles/store'
import { useToast } from '@/pages/dashboard/angleStore'
import BattedBall from '@/pages/profiler/BattedBall'
import ContextRail from '@/pages/profiler/ContextRail'
import GameLogs from '@/pages/profiler/GameLogs'
import NewsFeed from '@/pages/profiler/NewsFeed'
import PlayerHeader from '@/pages/profiler/PlayerHeader'
import PlayerSearch from '@/pages/profiler/PlayerSearch'
import Splits from '@/pages/profiler/Splits'
import StatcastStrip from '@/pages/profiler/StatcastStrip'
import {
  findPlayer,
  pushRecentPlayer,
  type AnyPlayer,
} from '@/pages/profiler/derive'
import type { ProfileTarget } from '@/pages/profiler/ProfileCard'

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

interface Props {
  target: ProfileTarget
  onClose: () => void
  onFollow: () => void
}

export default function ProfilerDrawer({ target, onClose, onFollow }: Props) {
  const [player, setPlayer] = useState<AnyPlayer>(target.player)
  const [searching, setSearching] = useState(false)
  const [toast, showToast] = useToast()
  const [followed, setFollowed] = useState(() => isFollowed(target.player.id))

  // Track the opening player in "recently viewed" and follow state.
  useEffect(() => {
    pushRecentPlayer(target.player.id)
  }, [target.player.id])
  useEffect(
    () => onFollowsChange(() => setFollowed(isFollowed(player.id))),
    [player.id],
  )

  // Escape closes; body scroll locks while the drawer is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const selectPlayer = (p: AnyPlayer) => {
    setPlayer(p)
    setSearching(false)
    pushRecentPlayer(p.id)
  }

  const selectById = (id: string) => {
    const p = findPlayer(id)
    if (p) selectPlayer(p)
  }

  const onAddToAngle = () => {
    const snap = playerSnapshot(player.id)
    if (!snap) {
      showToast('No live splits for this player yet — nothing to save')
      return
    }
    addAngle({
      title: snap.title,
      sport: snap.sport,
      type: 'table',
      note: '',
      tags: [],
      shared: false,
      snapshot: snap.snapshot,
    })
    showToast('Saved to My Angles')
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-[rgba(4,5,12,0.65)] backdrop-blur-[4px]"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.aside
        role="dialog"
        aria-label={`${player.name} player profile`}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        className="fixed bottom-0 right-0 top-0 z-50 flex w-[min(760px,100vw)] flex-col border-l border-line bg-bg-0"
      >
        {/* Top bar */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <button
            type="button"
            onClick={() => setSearching((v) => !v)}
            aria-label="Search another player"
            title="Search another player"
            className={`rounded-md border p-2 transition-colors ${
              searching
                ? 'border-sp-indigo/50 bg-sp-indigo/15 text-sp-indigo'
                : 'border-line bg-bg-2 text-text-2 hover:bg-bg-3 hover:text-text-1'
            }`}
          >
            <Search size={15} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold text-text-1">{player.name}</p>
            <p className="data-mono text-[10px] uppercase tracking-wider text-text-3">
              {player.team} · {player.sport.toUpperCase()}
            </p>
          </div>
          <button
            type="button"
            onClick={onFollow}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
              followed
                ? 'border-sp-indigo/50 bg-sp-indigo/15 text-sp-indigo'
                : 'border-line bg-bg-2 text-text-1 hover:bg-bg-3'
            }`}
          >
            {followed ? <UserCheck size={13} /> : <UserPlus size={13} />}
            {followed ? 'Following' : 'Follow'}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile"
            className="rounded-md border border-line bg-bg-2 p-2 text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {searching ? (
              <motion.div
                key="search"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="px-4 pb-16"
              >
                <PlayerSearch onSelect={selectPlayer} />
              </motion.div>
            ) : (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="space-y-5 px-4 py-5 pb-16"
              >
                <PlayerHeader player={player} onAddToAngle={onAddToAngle} onToast={showToast} />
                <StatcastStrip player={player} />

                <section aria-label="Game logs">
                  <h3 className="overline-caption mb-3 text-text-3">Game logs</h3>
                  <GameLogs player={player} />
                </section>

                <section aria-label="Splits">
                  <h3 className="overline-caption mb-3 text-text-3">Splits</h3>
                  <Splits player={player} />
                </section>

                <BattedBall player={player} />

                <section aria-label="News">
                  <h3 className="overline-caption mb-3 text-text-3">News</h3>
                  <NewsFeed player={player} />
                </section>

                <ContextRail player={player} onSelectPlayer={selectById} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-md border border-line bg-bg-2 px-4 py-2.5 shadow-raised"
              role="status"
            >
              <span className="text-[13px] font-medium text-text-1">{toast}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>
    </>
  )
}
