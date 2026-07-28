import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { LayoutGrid, List, Lock } from 'lucide-react'
import { getGame, getSlate } from '@/data/slate'
import { getPlan } from '@/lib/plan'
import { SLATE_DAY_LABEL, useSlateDay } from '@/lib/slateDay'
import GameCard from './gamecenter/GameCard'
import GameDetail from './gamecenter/GameDetail'
import TomorrowSlate from './gamecenter/TomorrowSlate'
import { ToastViewport } from './gamecenter/kit'

/**
 * GameCenter (/gamecenter) — per-game AI-style matchup breakdowns.
 * Gated: All Access (Dashboards plan sees the upgrade wall).
 *
 * Follows the topbar Today/Tomorrow stepper. Tomorrow has no hydrated slate,
 * so it renders schedule facts + weather (TomorrowSlate) with an honest
 * placeholder where analysis would go — never today's numbers redated.
 */
export default function GameCenter() {
  const [sport, setSport] = useState<'mlb' | 'nhl'>('mlb')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [searchParams, setSearchParams] = useSearchParams()
  const day = useSlateDay()

  const selectedId = searchParams.get('game')
  const selected = selectedId ? getGame(selectedId) : undefined
  const games = useMemo(() => getSlate(sport), [sport])

  const selectGame = (id: string) => {
    setSearchParams({ game: id })
    window.scrollTo({ top: 0 })
  }
  const clearGame = () => setSearchParams({})

  const isAllAccess = getPlan() === 'allaccess'

  return (
    <div>
      {/* S1 — Page header row */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-text-1">
          {day === 'tomorrow' ? "Tomorrow's matchups" : "Tonight's matchups"}
        </h2>
        <span className="data-mono rounded-sm border border-line bg-bg-2 px-2 py-1 text-[11px] text-text-2">
          {SLATE_DAY_LABEL[day]}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {/* Sport toggle */}
          <div className="flex rounded-md bg-bg-2 p-1">
            {(['mlb', 'nhl'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSport(s)}
                className={`data-mono rounded-sm px-3 py-1.5 text-[12px] font-semibold uppercase transition-all duration-200 ${
                  sport === s ? 'bg-bg-3 text-sp-indigo' : 'text-text-3 hover:text-text-1'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {/* View toggle */}
          <div className="flex rounded-md bg-bg-2 p-1">
            <button
              type="button"
              onClick={() => setView('grid')}
              aria-label="Grid view"
              className={`rounded-sm p-1.5 transition-colors ${
                view === 'grid' ? 'bg-bg-3 text-sp-indigo' : 'text-text-3 hover:text-text-1'
              }`}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              aria-label="List view"
              className={`rounded-sm p-1.5 transition-colors ${
                view === 'list' ? 'bg-bg-3 text-sp-indigo' : 'text-text-3 hover:text-text-1'
              }`}
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {!isAllAccess ? (
        /* Upgrade wall — Dashboards plan */
        <div className="relative">
          <div className="pointer-events-none grid gap-4 opacity-40 blur-[6px] md:grid-cols-2" aria-hidden>
            {games.slice(0, 4).map((g, i) => (
              <GameCard key={g.id} game={g} index={i} view="grid" onSelect={() => {}} />
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="prizm-card raised max-w-sm p-8 text-center">
              <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-sp-indigo/15 text-sp-indigo">
                <Lock size={20} strokeWidth={1.5} />
              </span>
              <h3 className="font-display text-xl font-semibold text-text-1">
                GameCenter is All Access
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-text-2">
                Per-game AI reads, splits matrices, and betting angles for every matchup on the
                slate. Upgrade to unlock the full breakdown.
              </p>
              <Link
                to="/pricing"
                className="mt-5 inline-block rounded-md bg-sp-indigo px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Upgrade to All Access
              </Link>
            </div>
          </div>
        </div>
      ) : day === 'tomorrow' ? (
        /* Tomorrow — schedule facts + weather; analysis honestly absent */
        sport === 'mlb' ? (
          <TomorrowSlate />
        ) : (
          <div className="prizm-card p-8 text-[13px] leading-relaxed text-text-3">
            Tomorrow's NHL slate is not carried — the NHL slate comes from the warehouse, which
            ingests the current day only. Step back to Today for tonight's games.
          </div>
        )
      ) : selected ? (
        /* S3 — Detail drill-in (same route, ?game=<id>) */
        <GameDetail game={selected} onBack={clearGame} onSelect={selectGame} />
      ) : (
        /* S2 — Slate grid / list */
        <div
          className={
            view === 'grid' ? 'grid gap-4 md:grid-cols-2' : 'flex flex-col gap-3'
          }
        >
          {games.map((g, i) => (
            <GameCard key={g.id} game={g} index={i} view={view} onSelect={() => selectGame(g.id)} />
          ))}
        </div>
      )}

      <ToastViewport />
    </div>
  )
}
