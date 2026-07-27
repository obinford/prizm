// MLB Dashboard (/dashboard) — Prizm's flagship page.
// S1 page header · S2 module tabs · S3 filter bar + pins/views · S5 pitcher
// split table · S7 batting lineups · S8 bullpen · S9 mobile card/sheet UX.
// App shell, topbar, auth gate and theme toggle live in the shared AppShell.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ListFilter, RotateCcw, Search, X } from 'lucide-react'
import FilterBar, { getSavedViews } from '@/components/FilterBar'
import type { FilterDef, FilterValues } from '@/components/FilterBar'
import { useSearchParams } from 'react-router'
import { SLATE_DAY_LABEL, useSlateDay } from '@/lib/slateDay'
import { MLB_SLATE } from '@/data/slate'
import { MLB_TEAMS } from '@/data/mlbTeams'
import PitcherTable from './PitcherTable'
import LineupsTab from './LineupsTab'
import BullpenTab from './BullpenTab'
import TeamsTab from './TeamsTab'
import TabPlaceholder from './TabPlaceholder'
import GameCenter from '@/pages/GameCenter'
import EdgeCenter from '@/pages/EdgeCenter'
import HitRates from '@/pages/HitRates'
import type { SplitKey } from './utils'
import { getStarters, windowSubset } from './utils'
import type { FilterRule } from '@/lib/filterRules'

// Seven MLB tabs in one dashboard. Gamecenter, Edgecenter and Hit Rates used to
// be separate sidebar routes; they are tabs now so the whole MLB workflow shares
// one control stack and one date context. DFS is deliberately out of scope.
type TabKey =
  | 'gamecenter'
  | 'edgecenter'
  | 'starters'
  | 'teams'
  | 'bullpen'
  | 'batters'
  | 'weather'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'gamecenter', label: 'Gamecenter' },
  { key: 'edgecenter', label: 'Edgecenter' },
  { key: 'starters', label: 'Starters' },
  { key: 'teams', label: 'Team Stats' },
  { key: 'bullpen', label: 'Bullpen' },
  { key: 'batters', label: 'Batters' },
  { key: 'weather', label: 'Weather' },
]

/** Tabs that use the shared filter bar + search. The rest are self-contained. */
const FILTERED_TABS: TabKey[] = ['starters', 'bullpen', 'batters', 'teams']

/** Tabs offering the TABLE | HIT RATES view toggle. */
const VIEW_MODE_TABS: TabKey[] = ['starters', 'batters']

type ViewMode = 'table' | 'hitrates'



// Market options are tab-shaped: pitcher props on Starters, batter props on
// Batters. Bullpen has no market mapping and keeps the pitcher set harmlessly
// (BullpenTab ignores values.market).
const PITCHER_MARKET_OPTIONS = [
  { value: 'ks', label: 'Strikeouts' },
  { value: 'hits', label: 'Hits allowed' },
  { value: 'er', label: 'Earned runs' },
  { value: 'outs', label: 'Outs recorded' },
]

const BATTER_MARKET_OPTIONS = [
  { value: 'hits', label: 'Hits' },
  { value: 'tb', label: 'Total bases' },
  { value: 'hr', label: 'Home runs' },
  { value: '2b', label: 'Doubles' },
  { value: 'ks', label: 'Strikeouts' },
  { value: 'bb', label: 'Walks' },
]

const FILTERS: FilterDef[] = [
  {
    key: 'split',
    label: 'Split',
    options: [
      { value: 'vs-lhb', label: 'vs LHB' },
      { value: 'vs-rhb', label: 'vs RHB' },
    ],
  },
  {
    key: 'handedness',
    label: 'Handedness',
    options: [
      { value: 'L', label: 'vs LHP' },
      { value: 'R', label: 'vs RHP' },
    ],
  },
  {
    key: 'venue',
    label: 'Venue',
    options: [
      { value: 'home', label: 'Home' },
      { value: 'away', label: 'Away' },
    ],
  },
  {
    key: 'market',
    label: 'Market',
    options: PITCHER_MARKET_OPTIONS,
  },
  {
    key: 'window',
    label: 'Window',
    options: [
      { value: 'L30', label: 'L30 PA' },
      { value: 'L60', label: 'L60 PA' },
      { value: 'L90', label: 'L90 PA' },
      { value: 'L120', label: 'L120 PA' },
    ],
  },
]

// Saved views and pins are scoped per tab ('dashboard-mlb:starters', …), not
// per dashboard — a Starters view offering itself on Team Stats would carry
// half-dormant rules. Views saved under the bare 'dashboard-mlb' scope before
// this change stop appearing; FilterBar surfaces them with a re-scope offer.
const scopeFor = (tab: TabKey) => `dashboard-mlb:${tab}`

const TAB_HEADER: Record<TabKey, { title: string; search: string }> = {
  gamecenter: { title: "Tonight's matchups", search: '' },
  edgecenter: { title: 'The daily edge report', search: '' },
  starters: { title: "Today's starting pitchers", search: 'Search pitcher…' },
  teams: { title: 'Team offense', search: 'Search team…' },
  bullpen: { title: 'Bullpen dashboard', search: 'Search team…' },
  batters: { title: 'Projected batting lineups', search: 'Search batter…' },
  weather: { title: 'Weather & ballpark factors', search: '' },
}

const STARTERS = getStarters()

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}

export default function Dashboard() {
  // ?tab= and ?view= let the old /gamecenter, /edgecenter and /hit-rates URLs
  // redirect straight to the right tab instead of 404ing.
  const [params] = useSearchParams()
  const paramTab = params.get('tab') as TabKey | null
  const paramView = params.get('view') as ViewMode | null
  const [tab, setTab] = useState<TabKey>(
    paramTab && TABS.some((t) => t.key === paramTab) ? paramTab : 'gamecenter',
  )
  const [viewMode, setViewMode] = useState<ViewMode>(
    paramView === 'hitrates' ? 'hitrates' : 'table',
  )
  const day = useSlateDay()
  const scope = scopeFor(tab)
  // Default view (saved with "make default") applies on first load (§7.8).
  // Its rules restore when the view is applied from the Views menu — the
  // tab-local rule state does not exist yet at this initializer.
  const [values, setValues] = useState<FilterValues>(
    () => getSavedViews(scopeFor(tab)).find((v) => v.isDefault)?.values ?? {},
  )
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const isMobile = useIsMobile()

  // Rules live in the active tab (they are column-scoped and must not
  // hoist). This ref is the bridge FilterBar uses to save/restore them:
  // the tab registers { rules, apply } while mounted, null when not.
  const rulesApiRef = useRef<{ rules: FilterRule[]; apply: (r: FilterRule[]) => void } | null>(
    null,
  )
  const registerRules = useCallback(
    (api: { rules: FilterRule[]; apply: (r: FilterRule[]) => void } | null) => {
      rulesApiRef.current = api
    },
    [],
  )

  // Skeleton shimmer 500ms on route/tab enter, then rows stagger in (§S5).
  // Reset during render when the tab changes (React-sanctioned pattern),
  // then let the effect clear it after the shimmer window.
  const [prevTab, setPrevTab] = useState(tab)
  if (prevTab !== tab) {
    setPrevTab(tab)
    setLoading(true)
  }
  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => setLoading(false), 500)
    return () => clearTimeout(t)
  }, [loading])

  const filterSig = useMemo(() => JSON.stringify([values, query]), [values, query])

  const starters = useMemo(() => {
    const q = query.trim().toLowerCase()
    return STARTERS.filter(
      (e) =>
        (!values.handedness || e.pitcher.throws === values.handedness) &&
        (!values.venue || e.homeAway.toLowerCase() === values.venue) &&
        (!q || e.pitcher.name.toLowerCase().includes(q)),
    )
  }, [values.handedness, values.venue, query])

  const windows = windowSubset(values.window)

  // The Market chip shows batter props only while the Batters tab is active.
  // Team Stats has no applicable chips — it gets the search box only, and its
  // own PA-split selector inside the tab.
  const filters = useMemo<FilterDef[]>(() => {
    if (tab === 'teams') return []
    return tab === 'batters'
      ? FILTERS.map((f) => (f.key === 'market' ? { ...f, options: BATTER_MARKET_OPTIONS } : f))
      : FILTERS
  }, [tab])
  const split = (values.split === 'vs-lhb' || values.split === 'vs-rhb' ? values.split : undefined) as
    | SplitKey
    | undefined

  const activeCount = Object.values(values).filter(Boolean).length + (query.trim() ? 1 : 0)

  const reset = () => {
    setValues({})
    setQuery('')
  }

  const dayLabel = SLATE_DAY_LABEL[day]

  const metaChip = useMemo(() => {
    if (tab === 'starters') return `${dayLabel} · ${MLB_SLATE.length} games · ${starters.length} starters`
    if (tab === 'batters') return `${dayLabel} · ${MLB_SLATE.length} games · projected lineups`
    if (tab === 'bullpen') return `${MLB_TEAMS.length} teams`
    return dayLabel
  }, [tab, starters.length, dayLabel])

  const searchInput = (
    <div className="relative">
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={TAB_HEADER[tab].search}
        aria-label={TAB_HEADER[tab].search}
        className="data-mono h-9 w-full rounded-sm border border-line bg-bg-2 pl-8 pr-3 text-[13px] text-text-1 placeholder:text-text-3 focus:border-sp-indigo focus:outline-none focus:ring-[3px] focus:ring-[rgba(99,102,241,0.25)] sm:w-52"
      />
    </div>
  )

  const fadeRise = (i: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay: i * 0.05 },
  })

  return (
    <div className="space-y-5">
      {/* S1 — page header */}
      <motion.div {...fadeRise(0)} className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-text-1">
          {TAB_HEADER[tab].title}
        </h2>
        <span className="data-mono rounded-sm border border-line bg-bg-2 px-2 py-1 text-[12px] text-text-2">
          {metaChip}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="flex min-h-10 items-center gap-1.5 rounded-md px-3 py-2 text-sm text-text-2 transition-colors hover:text-text-1"
          >
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </motion.div>

      {/* S2 — module tabs (underline, indigo bar slides 250ms) */}
      <motion.div {...fadeRise(1)} className="flex items-center gap-1 border-b border-line" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.key ? 'text-text-1' : 'text-text-2 hover:text-text-1'
            }`}
          >
            {t.label}
            {tab === t.key && (
              <motion.span
                layoutId="dashboard-tab-underline"
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-sp-indigo"
              />
            )}
          </button>
        ))}
      </motion.div>

      {/* View-mode toggle — TABLE | HIT RATES, on Starters and Batters only */}
      {VIEW_MODE_TABS.includes(tab) && (
        <motion.div {...fadeRise(2)} className="flex items-center gap-2">
          <span className="overline-caption text-text-3">View</span>
          <div className="inline-flex rounded-md border border-line bg-bg-1 p-0.5" role="group" aria-label="View mode">
            {(['table', 'hitrates'] as ViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                aria-pressed={viewMode === m}
                className={`rounded px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wider transition-colors ${
                  viewMode === m ? 'bg-bg-3 text-text-1' : 'text-text-3 hover:text-text-1'
                }`}
              >
                {m === 'table' ? 'Table' : 'Hit Rates'}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* S3 — filter bar + pinned row (desktop) / filter sheet button (mobile) */}
      {FILTERED_TABS.includes(tab) && (
      <motion.div {...fadeRise(2)}>
        {isMobile ? (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-bg-1 px-4 py-3 text-sm font-medium text-text-1 transition-colors hover:bg-bg-2"
          >
            <ListFilter size={15} className="text-sp-indigo" />
            Filters{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
        ) : (
          <div className="prizm-card space-y-3 p-4">
            {searchInput}
            {filters.length > 0 && (
              <FilterBar
                filters={filters}
                values={values}
                onChange={setValues}
                scope={scope}
                getRules={() => rulesApiRef.current?.rules ?? []}
                applyRules={(r) => rulesApiRef.current?.apply(r)}
              />
            )}
          </div>
        )}
      </motion.div>
      )}

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {tab === 'gamecenter' && <GameCenter />}
          {tab === 'edgecenter' && <EdgeCenter />}

          {tab === 'starters' &&
            (viewMode === 'hitrates' ? (
              <HitRates />
            ) : (
              <PitcherTable
                entries={starters}
                loading={loading}
                market={values.market}
                windows={windows}
                split={split}
                filterSig={filterSig}
                onResetFilters={reset}
                registerRules={registerRules}
              />
            ))}

          {tab === 'batters' &&
            (viewMode === 'hitrates' ? (
              <HitRates />
            ) : (
              <LineupsTab loading={loading} values={values} query={query} onResetFilters={reset} registerRules={registerRules} />
            ))}

          {tab === 'bullpen' && (
            <BullpenTab loading={loading} query={query} filterSig={filterSig} onResetFilters={reset} registerRules={registerRules} />
          )}

          {tab === 'teams' && (
            <TeamsTab loading={loading} query={query} filterSig={filterSig} onResetFilters={reset} registerRules={registerRules} />
          )}

          {tab === 'weather' && (
            <TabPlaceholder
              title="Weather & ballpark factors"
              summary="One card per game: park name and roof state, field dimensions, live conditions, and both a base park factor and a weather-adjusted one — so you can see how much of tonight's number is the park and how much is the air."
              blockers={[
                'slate_games.weatherJson exists in db/schema.ts and is never written or read',
                'No weather provider is wired into the ingest',
                'Roof state, field dimensions and wind direction have no source',
              ]}
              available={[
                'parkFactor and ballpark are populated for all 30 teams in src/data/mlbTeams.ts and rendered nowhere',
              ]}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* S9 — mobile filters bottom sheet (slides up 300ms) */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-[rgba(4,5,12,0.7)] backdrop-blur-[8px]"
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-xl border-t border-line bg-bg-1 p-4"
              role="dialog"
              aria-label="Filters"
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="font-display text-base font-semibold text-text-1">Filters</p>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="rounded-md p-2 text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
                  aria-label="Close filters"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3 pb-2">
                {searchInput}
                {filters.length > 0 && (
                  <FilterBar
                    filters={filters}
                    values={values}
                    onChange={setValues}
                    scope={scope}
                    getRules={() => rulesApiRef.current?.rules ?? []}
                    applyRules={(r) => rulesApiRef.current?.apply(r)}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="w-full rounded-md bg-sp-indigo px-4 py-3 text-sm font-semibold text-white transition-all hover:brightness-110"
                >
                  Show results{activeCount > 0 ? ` (${activeCount})` : ''}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
