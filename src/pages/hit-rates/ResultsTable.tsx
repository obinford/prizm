import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ArrowUp, Bookmark, Check, Columns3, UserRound, X, Zap } from 'lucide-react'
import type { HitWindow, PropLine, PropSide } from '@/data/props'
import {
  HIT_WINDOWS,
  bestOverTag,
  bestUnderTag,
  consensusOver,
  consensusUnder,
  devigProp,
  formatOdds,
  hasRealOdds,
  opposingPitcherHand,
  sideEdgePp,
  sideRate,
} from '@/data/props'
import { addAngle, propSnapshot } from '@/pages/angles/store'
import { MARKET_ICONS } from '@/pages/hit-rates/ScannerControls'
import { useProfileDrawer } from '@/pages/profiler/useProfileDrawer'

export type SortDir = 'asc' | 'desc'

const WINDOW_N: Record<HitWindow, number> = { L5: 5, L10: 10, L20: 20 }



// ---------------------------------------------------------------------------
// Hit-rate bar (design.md §7.11): 4px track, indigo→cyan fill, ≥70% pos-red
// ---------------------------------------------------------------------------

function HitBar({
  rate,
  windowKey,
  primary,
  rowIndex,
  resetKey,
  approx = false,
}: {
  rate: number
  windowKey: HitWindow
  primary: boolean
  rowIndex: number
  resetKey: string
  /** true when the rate is 1 − over (no per-game log) — pushes not excluded */
  approx?: boolean
}) {
  const pct = Math.round(rate * 100)
  const hits = Math.round(rate * WINDOW_N[windowKey])
  const hot = rate >= 0.7
  return (
    <div
      className={primary ? '' : 'opacity-75'}
      title={approx ? 'Complement of the over rate — pushes not excluded (no per-game log for this row)' : undefined}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`data-mono ${primary ? 'text-[13px] font-bold' : 'text-[11px] font-medium'} ${
            hot ? 'text-[#FCA5A5]' : 'text-text-1'
          }`}
        >
          {pct}%
        </span>
        <span className="data-mono text-[10px] text-text-3">
          {hits}/{WINDOW_N[windowKey]}
        </span>
      </div>
      <div className={`mt-1 ${primary ? 'h-1' : 'h-[3px]'} overflow-hidden rounded-full bg-bg-3`}>
        <motion.div
          key={`${resetKey}-${windowKey}-${pct}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: primary ? 0.5 : 0.4, delay: rowIndex * 0.015, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full"
          style={{
            background: hot
              ? 'linear-gradient(90deg, #EF4444 0%, #F87171 100%)'
              : 'linear-gradient(90deg, #6366F1 0%, #22D3EE 100%)',
          }}
        />
      </div>
    </div>
  )
}

/**
 * Real-odds price block (design.md §data-mono): ACTIVE side's consensus price
 * first, the other side second; best-book tag for the active side. NHL rows
 * have no odds feed — flat price + note.
 */
function PriceBlock({ prop, side, compact }: { prop: PropLine; side: PropSide; compact?: boolean }) {
  const real = hasRealOdds(prop)
  const best = side === 'over' ? bestOverTag(prop) : bestUnderTag(prop)
  const overTxt = formatOdds(consensusOver(prop))
  const underTxt = formatOdds(consensusUnder(prop))
  return (
    <span className="block">
      <span className={`data-mono block text-text-2 ${compact ? 'text-[11px]' : 'text-[11px]'}`}>
        {side === 'over' ? (
          <>
            {overTxt}
            <span className="text-text-3"> / u </span>
            {underTxt}
          </>
        ) : (
          <>
            <span className="text-text-3">u </span>
            {underTxt}
            <span className="text-text-3"> / o </span>
            {overTxt}
          </>
        )}
        {real && prop.books != null && (
          <span className="ml-1.5 text-[10px] text-text-3">{prop.books} books</span>
        )}
      </span>
      {best ? (
        <span className="data-mono mt-0.5 inline-block rounded-sm border border-sp-indigo/40 bg-sp-indigo/10 px-1 py-px text-[9px] font-semibold tracking-wide text-sp-indigo">
          best {best}
        </span>
      ) : (
        !real && (
          <span className="data-mono mt-0.5 block text-[9px] text-text-3/70">no odds feed · flat price</span>
        )
      )}
    </span>
  )
}

function ValueBadge({ rowIndex }: { rowIndex: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{
        opacity: 1,
        scale: 1,
        boxShadow: [
          '0 0 0px rgba(251,191,36,0)',
          '0 0 16px rgba(251,191,36,0.55)',
          '0 0 0px rgba(251,191,36,0)',
        ],
      }}
      transition={{
        opacity: { duration: 0.2, delay: rowIndex * 0.015 },
        scale: { duration: 0.2, delay: rowIndex * 0.015 },
        boxShadow: { duration: 2, delay: 0.4 + rowIndex * 0.015 },
      }}
      className="data-mono inline-flex items-center gap-1 rounded-sm border border-sp-amber/40 bg-sp-amber/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-sp-amber"
    >
      <Zap size={11} fill="currentColor" strokeWidth={1.5} />
      VALUE
    </motion.span>
  )
}

/**
 * De-vigged consensus probability for the active side, labelled as de-vigged
 * (the raw implied number includes the hold and overstates the true price).
 * Em-dash when a side is missing — a one-sided de-vig is not a de-vig.
 */
function FairCell({ prop, side }: { prop: PropLine; side: PropSide }) {
  const fair = devigProp(prop)
  if (!fair) {
    return (
      <span className="data-mono text-text-3" title="No two-sided consensus price — cannot de-vig">
        —
      </span>
    )
  }
  const v = side === 'over' ? fair.over : fair.under
  return (
    <span
      className="data-mono text-[12px] font-semibold text-text-1"
      title={`De-vigged ${side} probability (multiplicative method) — ${(fair.hold * 100).toFixed(1)}% hold removed`}
    >
      {Math.round(v * 100)}%
    </span>
  )
}

/**
 * Numeric side edge (hit rate − de-vigged price, percentage points) on the
 * selected edge window, plus the server-fixed VALUE badge. The badge's
 * threshold is computed server-side (blended windows vs raw implied) and does
 * not move with the edge-window selector — the number beside it does.
 */
function EdgeCell({
  prop,
  side,
  edgeWindow,
  rowIndex,
}: {
  prop: PropLine
  side: PropSide
  edgeWindow: HitWindow
  rowIndex: number
}) {
  const edge = sideEdgePp(prop, edgeWindow, side)
  return (
    <div className="flex flex-col items-center gap-1">
      {edge != null ? (
        <span
          className={`data-mono text-[12px] font-bold ${edge >= 0 ? 'text-[#FCA5A5]' : 'text-[#93C5FD]'}`}
          title={`${edgeWindow} ${side} hit rate minus the de-vigged ${side} price — a historical rate vs a fair price, not a model probability`}
        >
          {edge >= 0 ? '+' : ''}
          {edge.toFixed(1)}pp
        </span>
      ) : (
        <span className="data-mono text-text-3" title="No real two-sided odds — no edge to compute">
          —
        </span>
      )}
      {prop.priceAlert && <ValueBadge rowIndex={rowIndex} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Drawer
// ---------------------------------------------------------------------------

function PropDrawer({
  prop,
  side,
  onClose,
  onOpenProfile,
}: {
  prop: PropLine
  side: PropSide
  onClose: () => void
  /** Step 15 — opens the profiler drawer over the table (replaces the old
   *  /profiler link that carried no player param). */
  onOpenProfile: () => void
}) {
  const [added, setAdded] = useState(false)
  // Real per-game outcomes from game_logs (propsRouter.recentValues), compared
  // against the actual line on the ACTIVE side (a push is neither a hit nor a
  // miss — `v < line` for under, `v > line` for over). Previously both of
  // these were hash streams: the hit/miss strip could not reconcile with the
  // L10% shown beside it, and the "line history" sparkline had no source at
  // all (sv_odds keeps one row per player/prop/date). The sparkline is gone
  // until line history is retained.
  const log = useMemo(() => {
    const vals = prop.recentValues
    if (!vals || vals.length === 0) return null
    return vals.slice(0, 10).map((v) => (side === 'over' ? v > prop.line : v < prop.line))
  }, [prop, side])

  const Icon = MARKET_ICONS[prop.market]

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-[rgba(4,5,12,0.7)] backdrop-blur-[8px]"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: 420 }}
        animate={{ x: 0 }}
        exit={{ x: 420 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-[420px] overflow-y-auto border-l border-line bg-bg-1 p-6"
        role="dialog"
        aria-label={`${prop.player} prop details`}
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="font-display text-2xl font-semibold text-text-1">{prop.player}</h3>
            <p className="data-mono mt-1 text-xs text-text-3">
              {prop.team} · {prop.opponent} · {prop.sport.toUpperCase()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
            aria-label="Close details"
          >
            <X size={18} />
          </button>
        </div>

        {/* Prop summary — active side first */}
        <div className="mb-6 flex items-center justify-between rounded-md border border-line bg-bg-2 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-text-1">
            <Icon size={15} strokeWidth={1.5} className="text-sp-indigo" />
            <span className="data-mono">
              {prop.market} {side === 'over' ? 'o' : 'u'}
              {prop.line}
            </span>
          </span>
          <span className="data-mono text-right text-sm text-text-2">
            {side === 'over' ? (
              <>
                {formatOdds(consensusOver(prop))} <span className="text-text-3">/ u</span>{' '}
                {formatOdds(consensusUnder(prop))}
              </>
            ) : (
              <>
                <span className="text-text-3">u</span> {formatOdds(consensusUnder(prop))}{' '}
                <span className="text-text-3">/ o</span> {formatOdds(consensusOver(prop))}
              </>
            )}
            {hasRealOdds(prop) && prop.books != null && (
              <span className="block text-[10px] text-text-3">consensus · {prop.books} books</span>
            )}
          </span>
        </div>

        {/* Best-book prices (real odds only) */}
        {hasRealOdds(prop) && (bestOverTag(prop) || bestUnderTag(prop)) && (
          <div className="-mt-4 mb-6 flex flex-wrap items-center gap-2">
            {bestOverTag(prop) && (
              <span className="data-mono rounded-sm border border-sp-indigo/40 bg-sp-indigo/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-sp-indigo">
                best over {bestOverTag(prop)}
              </span>
            )}
            {bestUnderTag(prop) && (
              <span className="data-mono rounded-sm border border-sp-indigo/40 bg-sp-indigo/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-sp-indigo">
                best under {bestUnderTag(prop)}
              </span>
            )}
          </div>
        )}

        {/* Hit rates — active side */}
        <p className="overline-caption mb-2 text-text-3">Hit rates · {side}</p>
        <div className="mb-6 grid grid-cols-3 gap-2">
          {HIT_WINDOWS.map((w) => {
            const sr = sideRate(prop, w, side)
            const pct = Math.round(sr.rate * 100)
            return (
              <div
                key={w}
                className="rounded-md border border-line bg-bg-2 px-3 py-2.5"
                title={sr.approx ? 'Complement of the over rate — pushes not excluded (no per-game log)' : undefined}
              >
                <span className="overline-caption block text-text-3">{w}</span>
                <span
                  className={`data-mono text-lg font-semibold ${
                    sr.rate >= 0.7 ? 'text-[#FCA5A5]' : 'text-text-1'
                  }`}
                >
                  {pct}%
                </span>
                <span className="data-mono ml-1 text-[10px] text-text-3">
                  {Math.round(sr.rate * WINDOW_N[w])}/{WINDOW_N[w]}
                </span>
              </div>
            )
          })}
        </div>

        {/* Game log strip */}
        <p className="overline-caption mb-2 text-text-3">Last 10 — {side} hit / miss</p>
        <div className="mb-6 flex items-center gap-1.5">
          {(log ?? []).map((hit, i) => (
            <motion.span
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25, delay: i * 0.02, ease: [0.34, 1.56, 0.64, 1] }}
              title={hit ? `Hit (${side})` : 'Miss'}
              className={`flex h-7 w-7 items-center justify-center rounded-sm text-[10px] font-bold ${
                hit ? 'bg-pos/20 text-[#FCA5A5]' : 'bg-neg/20 text-[#93C5FD]'
              }`}
            >
              {hit ? 'H' : 'M'}
            </motion.span>
          ))}
        </div>

        {/* Line history sparkline removed. sv_odds retains one row per
            player/prop/date with a single pulled_at, so there is no historical
            series to plot — the previous chart was `line + (hash - 0.5) * amp`.
            Returns when odds snapshots are retained over time. */}

        {prop.priceAlert && (
          <div className="mb-6 flex items-start gap-2.5 rounded-md border border-sp-amber/30 bg-sp-amber/10 px-4 py-3">
            <Zap size={15} className="mt-0.5 shrink-0 text-sp-amber" fill="currentColor" strokeWidth={1.5} />
            <p className="text-[13px] leading-relaxed text-text-2">
              Price alert — the {Math.round(prop.hitRates.L10 * 100)}% L10 hit rate implies value
              against {prop.market} o{prop.line} at{' '}
              <span className="data-mono text-text-1">{formatOdds(consensusOver(prop))}</span> consensus
              {hasRealOdds(prop) && (
                <>
                  {' '}(best <span className="data-mono text-text-1">{formatOdds(prop.overPrice)}</span>
                  {prop.overBook ? ` ${prop.overBook}` : ''} / u{' '}
                  <span className="data-mono text-text-1">{formatOdds(prop.underPrice)}</span>
                  {prop.underBook ? ` ${prop.underBook}` : ''}
                  {prop.books != null ? ` · ${prop.books} books` : ''})
                </>
              )}
              .
            </p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex-1 rounded-md border border-line bg-bg-2 px-4 py-2.5 text-center text-sm font-medium text-text-1 transition-colors hover:bg-bg-3"
          >
            Open profile →
          </button>
          <button
            type="button"
            onClick={() => {
              // Canonical My Angles shape (was the legacy hockey {label, detail} writer).
              addAngle({
                title: `${prop.player} ${prop.market} hit rate`,
                sport: prop.sport,
                type: 'edge',
                note: `${prop.team} ${prop.opponent} · ${formatOdds(prop.overPrice)}`,
                tags: [],
                shared: false,
                snapshot: propSnapshot(prop),
              })
              setAdded(true)
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-semibold transition-all ${
              added ? 'bg-success/15 text-success' : 'bg-sp-indigo text-white hover:brightness-110'
            }`}
          >
            {added ? <Check size={15} /> : <Bookmark size={15} />}
            {added ? 'Angle added' : 'Add to angle'}
          </button>
        </div>
      </motion.aside>
    </>
  )
}

// ---------------------------------------------------------------------------
// Results table
// ---------------------------------------------------------------------------

export interface ResultsTableProps {
  rows: PropLine[]
  window: HitWindow
  /** active side — labels, prices, rates, filters all follow it */
  side: PropSide
  /** window the numeric edge column is computed on */
  edgeWindow: HitWindow
  sortKey: HitWindow
  sortDir: SortDir
  onSort: (key: HitWindow) => void
  onBookmark: (prop: PropLine) => void
  bookmarked: Set<string>
  /** change to re-run bar animations after filter changes */
  resetKey: string
  /** render rows with a blur mask (upgrade-wall teaser) */
  teaser?: boolean
}

/** Optional desktop columns, all default-on. Core columns are not toggleable. */
const TOGGLEABLE_COLS = [
  { key: 'fair', label: 'Fair (de-vig)' },
  { key: 'throws', label: 'Throws' },
] as const
type ToggleableCol = (typeof TOGGLEABLE_COLS)[number]['key']

export default function ResultsTable({
  rows,
  window,
  side,
  edgeWindow,
  sortKey,
  sortDir,
  onSort,
  onBookmark,
  bookmarked,
  resetKey,
  teaser = false,
}: ResultsTableProps) {
  const [drawerProp, setDrawerProp] = useState<PropLine | null>(null)
  // Step 15 — "Open profile" row action: the profiler drawer over this table.
  const { openProfile, profileDrawer } = useProfileDrawer()
  const [hiddenCols, setHiddenCols] = useState<ReadonlySet<ToggleableCol>>(new Set())
  const [colsOpen, setColsOpen] = useState(false)
  const showCol = (c: ToggleableCol) => !hiddenCols.has(c)
  const toggleCol = (c: ToggleableCol) =>
    setHiddenCols((s) => {
      const next = new Set(s)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })

  const sortHeader = (w: HitWindow) => (
    <button
      type="button"
      onClick={() => onSort(w)}
      className={`data-mono inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider transition-colors ${
        sortKey === w ? 'text-sp-indigo' : 'text-text-3 hover:text-text-2'
      }`}
    >
      {w}
      {sortKey === w && (sortDir === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
    </button>
  )

  const renderCells = (p: PropLine, i: number) => (
    <>
      {/* Player */}
      <th scope="row" className="border-b border-line px-4 py-3 text-left font-normal">
        <span className="block text-sm font-medium text-text-1">{p.player}</span>
        <span className="data-mono block text-[11px] text-text-3">
          {p.team} · {p.opponent}
        </span>
      </th>
      {/* Prop — active side's line prefix and price first */}
      <td className="border-b border-l border-line px-4 py-3">
        <span className="data-mono block text-[13px] font-bold text-text-1">
          {p.market} {side === 'over' ? 'o' : 'u'}
          {p.line}
        </span>
        <PriceBlock prop={p} side={side} compact />
      </td>
      {/* Hit windows — active side's rate */}
      {HIT_WINDOWS.map((w) => {
        const sr = sideRate(p, w, side)
        return (
          <td key={w} className="border-b border-l border-line px-4 py-3">
            <HitBar rate={sr.rate} approx={sr.approx} windowKey={w} primary={w === window} rowIndex={i} resetKey={resetKey} />
          </td>
        )
      })}
      {/* Fair (de-vigged) probability, optional column */}
      {showCol('fair') && (
        <td className="border-b border-l border-line px-4 py-3 text-center">
          <FairCell prop={p} side={side} />
        </td>
      )}
      {/* Opposing pitcher's throwing hand, optional column */}
      {showCol('throws') && (
        <td className="border-b border-l border-line px-4 py-3 text-center">
          {(() => {
            const hand = opposingPitcherHand(p)
            return hand ? (
              <span className="data-mono text-[12px] font-semibold text-text-1">{hand}</span>
            ) : (
              <span className="data-mono text-text-3" title="No probable pitcher on the slate for this game">
                —
              </span>
            )
          })()}
        </td>
      )}
      {/* Edge — numeric side edge on the selected edge window + VALUE badge */}
      <td className="border-b border-l border-line px-4 py-3 text-center">
        <EdgeCell prop={p} side={side} edgeWindow={edgeWindow} rowIndex={i} />
      </td>
      {/* Row actions — profile drawer + bookmark */}
      <td className="border-b border-l border-line px-3 py-3 text-center">
        <div className="flex items-center justify-center">
          <button
            type="button"
            aria-label={`Open ${p.player} profile`}
            title="Open player profile"
            onClick={(e) => {
              e.stopPropagation()
              openProfile(p.playerId)
            }}
            className="-m-1.5 flex min-h-10 min-w-10 items-center justify-center rounded-sm p-1.5 text-text-3 transition-colors hover:bg-bg-3 hover:text-sp-indigo"
          >
            <UserRound size={15} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label={`Add ${p.player} ${p.market} to angles`}
            onClick={(e) => {
              e.stopPropagation()
              onBookmark(p)
            }}
            className={`-m-1.5 flex min-h-10 min-w-10 items-center justify-center rounded-sm p-1.5 transition-colors ${
              bookmarked.has(p.id) ? 'text-sp-magenta' : 'text-text-3 hover:bg-bg-3 hover:text-text-1'
            }`}
          >
            {bookmarked.has(p.id) ? <Check size={15} /> : <Bookmark size={15} strokeWidth={1.5} />}
          </button>
        </div>
      </td>
    </>
  )

  return (
    <div className={teaser ? 'pointer-events-none select-none' : ''}>
      {/* Column visibility — extends the scanner controls, desktop table only */}
      {!teaser && (
        <div className="relative hidden justify-end px-4 pt-3 sm:flex">
          <button
            type="button"
            onClick={() => setColsOpen((o) => !o)}
            aria-expanded={colsOpen}
            aria-label="Choose which columns render"
            className="flex items-center gap-1.5 rounded-sm border border-line bg-bg-2 px-2.5 py-1.5 text-[12px] font-medium text-text-2 transition-colors hover:text-text-1"
          >
            <Columns3 size={13} strokeWidth={1.5} />
            Columns
          </button>
          {colsOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setColsOpen(false)} />
              <div className="absolute right-4 top-full z-40 mt-1 w-44 rounded-md border border-line bg-bg-2 p-1.5 shadow-raised">
                {TOGGLEABLE_COLS.map((c) => (
                  <label
                    key={c.key}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-[12px] text-text-1 transition-colors hover:bg-bg-3"
                  >
                    <input
                      type="checkbox"
                      checked={showCol(c.key)}
                      onChange={() => toggleCol(c.key)}
                      className="accent-sp-indigo"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-bg-2">
              <th scope="col" className="min-w-[180px] border-b border-line px-4 py-2.5 text-left overline-caption text-text-3">
                Player
              </th>
              <th scope="col" className="min-w-[170px] border-b border-l border-line px-4 py-2.5 text-left overline-caption text-text-3">
                Prop
              </th>
              {HIT_WINDOWS.map((w) => (
                <th key={w} scope="col" className="min-w-[120px] border-b border-l border-line px-4 py-2.5 text-left">
                  {sortHeader(w)}
                </th>
              ))}
              {showCol('fair') && (
                <th
                  scope="col"
                  className="min-w-[90px] border-b border-l border-line px-4 py-2.5 text-center overline-caption text-text-3"
                  title="De-vigged consensus probability — the book's hold removed (multiplicative method)"
                >
                  Fair · de-vig
                </th>
              )}
              {showCol('throws') && (
                <th
                  scope="col"
                  className="min-w-[70px] border-b border-l border-line px-4 py-2.5 text-center overline-caption text-text-3"
                  title="Opposing probable pitcher's throwing hand"
                >
                  Throws
                </th>
              )}
              <th
                scope="col"
                className="min-w-[100px] border-b border-l border-line px-4 py-2.5 text-center overline-caption text-text-3"
                title="Hit rate minus the de-vigged price, percentage points — a historical rate vs a fair price, not a model probability"
              >
                Edge · {edgeWindow}
              </th>
              <th scope="col" className="w-20 border-b border-l border-line px-3 py-2.5" aria-label="Row actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <motion.tr
                key={p.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15, delay: i * 0.02 }}
                layout="position"
                onClick={() => !teaser && setDrawerProp(p)}
                className={`transition-colors ${teaser ? '' : 'cursor-pointer hover:bg-bg-3'}`}
              >
                {renderCells(p, i)}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="space-y-3 p-4 sm:hidden">
        {rows.map((p, i) => {
          const Icon = MARKET_ICONS[p.market]
          const bestTag = side === 'over' ? bestOverTag(p) : bestUnderTag(p)
          const fair = devigProp(p)
          const fairSide = fair ? (side === 'over' ? fair.over : fair.under) : null
          const hand = opposingPitcherHand(p)
          return (
            <motion.button
              key={p.id}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              onClick={() => !teaser && setDrawerProp(p)}
              className="w-full rounded-lg border border-line bg-bg-1 p-4 text-left"
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <span className="block text-sm font-semibold text-text-1">{p.player}</span>
                  <span className="data-mono text-[11px] text-text-3">
                    {p.team} · {p.opponent}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {p.priceAlert && <ValueBadge rowIndex={i} />}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Open profile"
                    onClick={(e) => {
                      e.stopPropagation()
                      openProfile(p.playerId)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && openProfile(p.playerId)}
                    className="-m-1 flex min-h-10 min-w-10 items-center justify-center rounded-sm p-1 text-text-3"
                  >
                    <UserRound size={15} strokeWidth={1.5} />
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Add to angles"
                    onClick={(e) => {
                      e.stopPropagation()
                      onBookmark(p)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && onBookmark(p)}
                    className={`-m-1 flex min-h-10 min-w-10 items-center justify-center rounded-sm p-1 ${bookmarked.has(p.id) ? 'text-sp-magenta' : 'text-text-3'}`}
                  >
                    {bookmarked.has(p.id) ? <Check size={15} /> : <Bookmark size={15} strokeWidth={1.5} />}
                  </span>
                </div>
              </div>
              <p className="data-mono mb-1.5 flex flex-wrap items-center gap-1.5 text-[12px] font-bold text-text-1">
                <Icon size={13} strokeWidth={1.5} className="text-sp-indigo" />
                {p.market} {side === 'over' ? 'o' : 'u'}
                {p.line}
                <span className="font-medium text-text-2">
                  {side === 'over' ? '' : 'u '}
                  {formatOdds(side === 'over' ? consensusOver(p) : consensusUnder(p))}
                </span>
                {bestTag && (
                  <span className="rounded-sm border border-sp-indigo/40 bg-sp-indigo/10 px-1 py-px text-[9px] font-semibold tracking-wide text-sp-indigo">
                    best {bestTag}
                  </span>
                )}
                {!hasRealOdds(p) && p.sport === 'nhl' && (
                  <span className="text-[9px] font-normal text-text-3/70">no odds feed</span>
                )}
              </p>
              {(fairSide != null || hand) && (
                <p className="data-mono mb-3 text-[10px] text-text-3">
                  {fairSide != null && <span>Fair {Math.round(fairSide * 100)}% (de-vig)</span>}
                  {fairSide != null && hand && <span> · </span>}
                  {hand && <span>opp {hand}HP</span>}
                </p>
              )}
              <div className={`grid grid-cols-3 gap-3 ${fairSide != null || hand ? '' : 'mt-1.5'}`}>
                {HIT_WINDOWS.map((w) => {
                  const sr = sideRate(p, w, side)
                  return (
                    <div key={w}>
                      <span className="overline-caption mb-1 block text-[9px] text-text-3">{w}</span>
                      <HitBar rate={sr.rate} approx={sr.approx} windowKey={w} primary={w === window} rowIndex={i} resetKey={resetKey} />
                    </div>
                  )
                })}
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {drawerProp && (
          <PropDrawer
            prop={drawerProp}
            side={side}
            onClose={() => setDrawerProp(null)}
            onOpenProfile={() => {
              const p = drawerProp
              setDrawerProp(null)
              if (p) openProfile(p.playerId)
            }}
          />
        )}
      </AnimatePresence>
      {profileDrawer}
    </div>
  )
}
