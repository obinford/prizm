import { motion } from 'framer-motion'
import {
  Award,
  CircleDot,
  Crosshair,
  Footprints,
  Goal,
  Layers,
  Rocket,
  Search,
  Shield,
  ShieldBan,
  Sigma,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Wind,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { HitWindow, PropMarket, PropSide } from '@/data/props'
import { HIT_WINDOWS, MLB_MARKETS, NHL_MARKETS, DERIVED_MARKETS } from '@/data/props'

export const MARKET_ICONS: Record<PropMarket, LucideIcon> = {
  XBH: Layers,
  'Total Bases': TrendingUp,
  Strikeouts: Wind,
  Hits: Target,
  SOG: Crosshair,
  Saves: Shield,
  Goals: Goal,
  Points: Award,
  // sv_odds markets (MLB)
  'Hits Allowed': ShieldBan,
  Outs: Timer,
  'Home Runs': Trophy,
  Singles: CircleDot,
  Doubles: Layers,
  RBIs: Award,
  Runs: Footprints,
  Walks: Footprints,
  'Stolen Bases': Rocket,
  'Hits + Runs + RBIs': Sigma,
}

export interface ScannerState {
  sport: 'mlb' | 'nhl'
  markets: PropMarket[]
  window: HitWindow
  minHit: number
  alertsOnly: boolean
  search: string
  /** which side of the line the rates/filters/sort act on */
  side: PropSide
  /** exact-line filter as typed; '' = any line */
  line: string
  /** window the numeric edge column is computed on */
  edgeWindow: HitWindow
}

interface Props {
  state: ScannerState
  onChange: (next: ScannerState) => void
}

const pop = { scale: [0.95, 1] }
const popTransition = { duration: 0.25, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] }

export default function ScannerControls({ state, onChange }: Props) {
  const markets = state.sport === 'mlb' ? MLB_MARKETS : NHL_MARKETS

  const toggleMarket = (m: PropMarket) => {
    const next = state.markets.includes(m)
      ? state.markets.filter((x) => x !== m)
      : [...state.markets, m]
    onChange({ ...state, markets: next })
  }

  return (
    <div className="prizm-card flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
      {/* Market multi-select chips */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Markets">
        {markets.map((m) => {
          const active = state.markets.length === 0 || state.markets.includes(m)
          const explicitly = state.markets.includes(m)
          const Icon = MARKET_ICONS[m]
          return (
            <motion.button
              key={`${state.sport}-${m}`}
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={explicitly ? { opacity: 1, ...pop } : { opacity: 1, scale: 1 }}
              transition={popTransition}
              onClick={() => toggleMarket(m)}
              aria-pressed={explicitly}
              className={`flex min-h-10 items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                explicitly
                  ? 'border-line-strong bg-bg-3 text-text-1'
                  : active
                    ? 'border-line bg-bg-2 text-text-2 hover:text-text-1'
                    : 'border-line bg-bg-2 text-text-3 opacity-60 hover:opacity-100 hover:text-text-2'
              }`}
            >
              <Icon size={13} strokeWidth={1.5} className={explicitly ? 'text-sp-indigo' : ''} />
              {m}
              {DERIVED_MARKETS.has(m) && (
                <span
                  title="Prizm-derived line from game logs — no book carries this market, so price, fair and edge columns dash out"
                  className="rounded-sm border border-line px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-text-3"
                >
                  derived
                </span>
              )}
            </motion.button>
          )
        })}
      </div>

      {/* Window segmented control */}
      <div
        className="flex items-center rounded-full border border-line bg-bg-2 p-0.5"
        role="group"
        aria-label="Hit-rate window"
      >
        {HIT_WINDOWS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => onChange({ ...state, window: w })}
            aria-pressed={state.window === w}
            className={`data-mono relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              state.window === w ? 'text-sp-indigo' : 'text-text-3 hover:text-text-2'
            }`}
          >
            {state.window === w && (
              <motion.span
                layoutId="hit-window-pill"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                className="absolute inset-0 rounded-full bg-bg-3"
              />
            )}
            <span className="relative">{w}</span>
          </button>
        ))}
      </div>

      {/* Over / Under segmented control */}
      <div
        className="flex items-center rounded-full border border-line bg-bg-2 p-0.5"
        role="group"
        aria-label="Side"
      >
        {(['over', 'under'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange({ ...state, side: s })}
            aria-pressed={state.side === s}
            className={`data-mono relative inline-flex min-h-10 items-center justify-center rounded-full px-4 py-1.5 text-[12px] font-bold uppercase tracking-wide transition-colors ${
              state.side === s ? 'text-sp-indigo' : 'text-text-3 hover:text-text-2'
            }`}
          >
            {state.side === s && (
              <motion.span
                layoutId="side-pill"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                className="absolute inset-0 rounded-full bg-bg-3"
              />
            )}
            <span className="relative">{s}</span>
          </button>
        ))}
      </div>

      {/* Exact-line filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="line-filter" className="overline-caption text-text-3">
          Line
        </label>
        <input
          id="line-filter"
          value={state.line}
          onChange={(e) => onChange({ ...state, line: e.target.value })}
          placeholder="any"
          inputMode="decimal"
          aria-label="Filter to an exact line"
          className="data-mono h-9 w-16 rounded-sm border border-line bg-bg-2 px-2 text-base text-text-1 placeholder:text-text-3 focus:border-sp-indigo focus:outline-none focus:ring-[3px] focus:ring-[rgba(99,102,241,0.25)] md:text-[13px]"
        />
      </div>

      {/* Min hit-rate slider */}
      <div className="flex items-center gap-2.5">
        <label htmlFor="min-hit" className="overline-caption text-text-3">
          Min hit
        </label>
        <input
          id="min-hit"
          type="range"
          min={0}
          max={100}
          step={5}
          value={state.minHit}
          onChange={(e) => onChange({ ...state, minHit: Number(e.target.value) })}
          className="h-1 w-28 cursor-pointer appearance-none rounded-full bg-bg-3 accent-sp-indigo"
        />
        <motion.span
          key={state.minHit}
          animate={pop}
          transition={popTransition}
          className="data-mono rounded-sm border border-line bg-bg-2 px-2 py-1 text-[11px] font-semibold text-text-1"
        >
          ≥{state.minHit}%
        </motion.span>
      </div>

      {/* Edge window selector — which window the numeric edge column uses */}
      <div className="flex items-center gap-2">
        <span className="overline-caption text-text-3">Edge</span>
        <div
          className="flex items-center rounded-full border border-line bg-bg-2 p-0.5"
          role="group"
          aria-label="Edge window"
        >
          {HIT_WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onChange({ ...state, edgeWindow: w })}
              aria-pressed={state.edgeWindow === w}
              className={`data-mono relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-full px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
                state.edgeWindow === w ? 'text-sp-indigo' : 'text-text-3 hover:text-text-2'
              }`}
            >
              {state.edgeWindow === w && (
                <motion.span
                  layoutId="edge-window-pill"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  className="absolute inset-0 rounded-full bg-bg-3"
                />
              )}
              <span className="relative">{w}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Price alerts only switch */}
      <motion.button
        type="button"
        role="switch"
        aria-checked={state.alertsOnly}
        animate={state.alertsOnly ? pop : { scale: 1 }}
        transition={popTransition}
        onClick={() => onChange({ ...state, alertsOnly: !state.alertsOnly })}
        className={`flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
          state.alertsOnly
            ? 'border-sp-amber/40 bg-sp-amber/10 text-sp-amber'
            : 'border-line bg-bg-2 text-text-2 hover:text-text-1'
        }`}
      >
        <Zap size={13} strokeWidth={1.5} fill={state.alertsOnly ? 'currentColor' : 'none'} />
        Price alerts only
        <span
          className={`relative h-4 w-7 rounded-full transition-colors ${
            state.alertsOnly ? 'bg-sp-amber' : 'bg-bg-3'
          }`}
        >
          <span
            className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform duration-200 ${
              state.alertsOnly ? 'translate-x-3.5' : 'translate-x-0.5'
            }`}
          />
        </span>
      </motion.button>

      {/* Search */}
      <div className="relative ml-auto">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
        <input
          value={state.search}
          onChange={(e) => onChange({ ...state, search: e.target.value })}
          placeholder="Search player…"
          aria-label="Search player"
          className="data-mono h-9 w-full rounded-sm border border-line bg-bg-2 pl-8 pr-3 text-base text-text-1 placeholder:text-text-3 focus:border-sp-indigo focus:outline-none focus:ring-[3px] focus:ring-[rgba(99,102,241,0.25)] sm:w-52 md:text-[13px]"
        />
      </div>
    </div>
  )
}
