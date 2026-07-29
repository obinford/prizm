import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AnimatePresence } from 'framer-motion'
import { Search } from 'lucide-react'
import { BATTERS, PITCHERS } from '@/data/mlbPlayers'
import { GOALIES, SKATERS } from '@/data/nhlPlayers'
import { toggleFollow } from '@/lib/follows'
import { findPlayer, kindOf, posLabel, sportOf } from '@/pages/profiler/derive'
import ProfilerDrawer from './profiler/Drawer'
import ProfileCard, { type ProfileKind, type ProfileTarget } from './profiler/ProfileCard'
import {
  FollowedRail,
  ProfilerHero,
  SECTION_EMPTY,
  typeCounts,
  type ProfileSection,
} from './profiler/extras'

const MLB_PLAYERS: ProfileTarget[] = [
  ...PITCHERS.map((p) => ({ kind: 'pitcher' as ProfileKind, player: p })),
  ...BATTERS.map((b) => ({ kind: 'batter' as ProfileKind, player: b })),
]
const NHL_PLAYERS: ProfileTarget[] = [
  ...GOALIES.map((g) => ({ kind: 'goalie' as ProfileKind, player: g })),
  ...SKATERS.map((s) => ({ kind: 'skater' as ProfileKind, player: s })),
]

export default function Profiler() {
  const [sport, setSport] = useState<'mlb' | 'nhl'>('mlb')
  const [search, setSearch] = useState('')
  const [team, setTeam] = useState('All')
  const [drawer, setDrawer] = useState<ProfileTarget | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  // Deep link: /profiler?player=<id> opens that player's drawer directly.
  // Row-level "Open profile" actions across the app rely on this param.
  useEffect(() => {
    const id = searchParams.get('player')
    if (!id) return
    const p = findPlayer(id)
    if (!p) return
    setSport(sportOf(p))
    setDrawer({ kind: kindOf(p), player: p })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const closeDrawer = () => {
    setDrawer(null)
    if (searchParams.has('player')) {
      const next = new URLSearchParams(searchParams)
      next.delete('player')
      setSearchParams(next, { replace: true })
    }
  }

  const pool = sport === 'mlb' ? MLB_PLAYERS : NHL_PLAYERS
  const teams = useMemo(
    () => ['All', ...new Set(pool.map((t) => t.player.team))],
    [pool],
  )

  const sections: ProfileSection[] = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matches = (t: ProfileTarget) =>
      (team === 'All' || t.player.team === team) &&
      (!q || t.player.name.toLowerCase().includes(q))
    if (sport === 'mlb') {
      return [
        { key: 'pitchers', label: 'Starting Pitchers', targets: pool.filter((t) => t.kind === 'pitcher' && matches(t)) },
        { key: 'batters', label: 'Batters', targets: pool.filter((t) => t.kind === 'batter' && matches(t)) },
      ]
    }
    return [
      { key: 'goalies', label: 'Goalies', targets: pool.filter((t) => t.kind === 'goalie' && matches(t)) },
      { key: 'skaters', label: 'Skaters', targets: pool.filter((t) => t.kind === 'skater' && matches(t)) },
    ]
  }, [pool, sport, search, team])

  const total = sections.reduce((n, s) => n + s.targets.length, 0)

  const followTarget = (t: ProfileTarget) => {
    toggleFollow({
      id: t.player.id,
      sport,
      name: t.player.name,
      team: t.player.team,
      role: posLabel(t.player),
    })
  }

  return (
    <div className="relative">
      <ProfilerHero />

      <div className="xl:pr-[300px]">
        {/* S2 — filter bar */}
        <div className="mb-6 mt-6 flex flex-wrap items-center gap-2.5">
          <div className="flex rounded-md bg-bg-2 p-1">
            {(['mlb', 'nhl'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSport(s)
                  setTeam('All')
                  setSearch('')
                }}
                className={`data-mono rounded-sm px-3.5 py-1.5 text-[12px] font-semibold uppercase transition-all duration-200 ${
                  sport === s ? 'bg-bg-3 text-sp-indigo' : 'text-text-3 hover:text-text-1'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players…"
              className="data-mono h-9 w-full rounded-sm border border-line bg-bg-2 pl-9 pr-3 text-[13px] text-text-1 placeholder:text-text-3 focus:border-sp-indigo focus:outline-none focus:ring-[3px] focus:ring-sp-indigo/25"
            />
          </div>
          <select
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className="data-mono h-9 rounded-sm border border-line bg-bg-2 px-2.5 text-[13px] text-text-1 focus:border-sp-indigo focus:outline-none"
          >
            {teams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <span className="data-mono text-[12px] text-text-3">{total} players</span>
        </div>

        {/* S3/S4 — sectioned grid */}
        {sections.map((section) => (
          <section key={section.key} className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <h3 className="font-display text-lg font-semibold text-text-1">{section.label}</h3>
              <span className="data-mono rounded-sm bg-bg-2 px-2 py-0.5 text-[11px] text-text-3">
                {section.targets.length}
              </span>
              <span className="h-px flex-1 bg-line" />
            </div>
            {section.targets.length === 0 ? (
              <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-text-3">
                {SECTION_EMPTY[section.key]}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {section.targets.map((t, i) => (
                  <ProfileCard
                    key={t.player.id}
                    target={t}
                    index={i}
                    onFollow={() => followTarget(t)}
                    onOpen={() => setDrawer(t)}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {/* S6 — followed rail */}
      <FollowedRail />

      {/* S5 — drawer */}
      <AnimatePresence>
        {drawer && (
          <ProfilerDrawer
            key={drawer.player.id}
            target={drawer}
            onClose={closeDrawer}
            onFollow={() => followTarget(drawer)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// re-export for FollowedRail counter
export { typeCounts as _typeCounts }
