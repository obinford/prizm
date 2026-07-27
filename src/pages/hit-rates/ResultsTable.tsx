import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ArrowUp, Bookmark, Check, X, Zap } from 'lucide-react'
import type { HitWindow, PropLine } from '@/data/props'
import {
  HIT_WINDOWS,
  bestOverTag,
  bestUnderTag,
  consensusOver,
  consensusUnder,
  formatOdds,
  hasRealOdds,
} from '@/data/props'
import { addAngle, propSnapshot } from '@/pages/angles/store'
import { MARKET_ICONS } from '@/pages/hit-rates/ScannerControls'

export type SortDir = 'asc' | 'desc'

const WINDOW_N: Record<HitWindow, number> = { L5: 5, L10: 10, L20: 20 }

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function stream(seed: string, n: number): number[] {
  let a = hash(seed)
  return Array.from({ length: n }, () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  })
}

// ---------------------------------------------------------------------------
// Hit-rate bar (design.md §7.11): 4px track, indigo→cyan fill, ≥70% pos-red
// ---------------------------------------------------------------------------

function HitBar({
  rate,
  windowKey,
  primary,
  rowIndex,
  resetKey,
}: {
  rate: number
  windowKey: HitWindow
  primary: boolean
  rowIndex: number
  resetKey: string
}) {
  const pct = Math.round(rate * 100)
  const hits = Math.round(rate * WINDOW_N[windowKey])
  const hot = rate >= 0.7
  return (
    <div className={primary ? '' : 'opacity-75'}>
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
 * Real-odds price block (design.md §data-mono): consensus price primary,
 * best-book tag secondary. NHL rows have no odds feed — flat price + note.
 */
function PriceBlock({ prop, compact }: { prop: PropLine; compact?: boolean }) {
  const real = hasRealOdds(prop)
  const best = bestOverTag(prop)
  return (
    <span className="block">
      <span className={`data-mono block text-text-2 ${compact ? 'text-[11px]' : 'text-[11px]'}`}>
        {formatOdds(consensusOver(prop))}
        <span className="text-text-3"> / u </span>
        {formatOdds(consensusUnder(prop))}
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

// ---------------------------------------------------------------------------
// Drawer
// ---------------------------------------------------------------------------

function PropDrawer({ prop, onClose }: { prop: PropLine; onClose: () => void }) {
  const [added, setAdded] = useState(false)
  const log = useMemo(() => {
    const r = stream(`${prop.id}-log`, 10)
    return r.map((v) => v < prop.hitRates.L10)
  }, [prop])
  const spark = useMemo(() => {
    const r = stream(`${prop.id}-line`, 10)
    const amp = prop.line <= 1 ? 0.25 : prop.line <= 2 ? 0.5 : 1
    return r.map((v) => +(prop.line + (v - 0.5) * 2 * amp).toFixed(1))
  }, [prop])

  const pts = spark
    .map((v, i) => {
      const min = Math.min(...spark, prop.line)
      const max = Math.max(...spark, prop.line)
      const span = Math.max(0.1, max - min)
      const x = 4 + (i / (spark.length - 1)) * 112
      const y = 22 - ((v - min) / span) * 18
      return `${x},${y}`
    })
    .join(' ')

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

        {/* Prop summary */}
        <div className="mb-6 flex items-center justify-between rounded-md border border-line bg-bg-2 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-text-1">
            <Icon size={15} strokeWidth={1.5} className="text-sp-indigo" />
            <span className="data-mono">
              {prop.market} o{prop.line}
            </span>
          </span>
          <span className="data-mono text-right text-sm text-text-2">
            {formatOdds(consensusOver(prop))} <span className="text-text-3">/ u</span> {formatOdds(consensusUnder(prop))}
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

        {/* Hit rates */}
        <p className="overline-caption mb-2 text-text-3">Hit rates</p>
        <div className="mb-6 grid grid-cols-3 gap-2">
          {HIT_WINDOWS.map((w) => {
            const pct = Math.round(prop.hitRates[w] * 100)
            return (
              <div key={w} className="rounded-md border border-line bg-bg-2 px-3 py-2.5">
                <span className="overline-caption block text-text-3">{w}</span>
                <span
                  className={`data-mono text-lg font-semibold ${
                    prop.hitRates[w] >= 0.7 ? 'text-[#FCA5A5]' : 'text-text-1'
                  }`}
                >
                  {pct}%
                </span>
                <span className="data-mono ml-1 text-[10px] text-text-3">
                  {Math.round(prop.hitRates[w] * WINDOW_N[w])}/{WINDOW_N[w]}
                </span>
              </div>
            )
          })}
        </div>

        {/* Game log strip */}
        <p className="overline-caption mb-2 text-text-3">Last 10 — over hit / miss</p>
        <div className="mb-6 flex items-center gap-1.5">
          {log.map((hit, i) => (
            <motion.span
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25, delay: i * 0.02, ease: [0.34, 1.56, 0.64, 1] }}
              title={hit ? 'Hit (over)' : 'Miss'}
              className={`flex h-7 w-7 items-center justify-center rounded-sm text-[10px] font-bold ${
                hit ? 'bg-pos/20 text-[#FCA5A5]' : 'bg-neg/20 text-[#93C5FD]'
              }`}
            >
              {hit ? 'H' : 'M'}
            </motion.span>
          ))}
        </div>

        {/* Line history sparkline */}
        <p className="overline-caption mb-2 text-text-3">Line history — last 10 slates</p>
        <div className="mb-6 rounded-md border border-line bg-bg-2 px-3 py-3">
          <svg viewBox="0 0 120 28" className="h-7 w-full" preserveAspectRatio="none" aria-hidden>
            <line x1="0" x2="120" y1="14" y2="14" stroke="var(--text-3)" strokeDasharray="3 3" strokeWidth="0.5" />
            <polyline points={pts} fill="none" stroke="#6366F1" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          <div className="mt-1 flex justify-between">
            <span className="data-mono text-[10px] text-text-3">10 slates ago</span>
            <span className="data-mono text-[10px] text-text-3">
              current o{prop.line}
            </span>
          </div>
        </div>

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
          <Link
            to="/profiler"
            className="flex-1 rounded-md border border-line bg-bg-2 px-4 py-2.5 text-center text-sm font-medium text-text-1 transition-colors hover:bg-bg-3"
          >
            Open in Profiler →
          </Link>
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

export default function ResultsTable({
  rows,
  window,
  sortKey,
  sortDir,
  onSort,
  onBookmark,
  bookmarked,
  resetKey,
  teaser = false,
}: ResultsTableProps) {
  const [drawerProp, setDrawerProp] = useState<PropLine | null>(null)

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
      {/* Prop */}
      <td className="border-b border-l border-line px-4 py-3">
        <span className="data-mono block text-[13px] font-bold text-text-1">
          {p.market} o{p.line}
        </span>
        <PriceBlock prop={p} compact />
      </td>
      {/* Hit windows */}
      {HIT_WINDOWS.map((w) => (
        <td key={w} className="border-b border-l border-line px-4 py-3">
          <HitBar rate={p.hitRates[w]} windowKey={w} primary={w === window} rowIndex={i} resetKey={resetKey} />
        </td>
      ))}
      {/* Edge */}
      <td className="border-b border-l border-line px-4 py-3 text-center">
        {p.priceAlert ? <ValueBadge rowIndex={i} /> : <span className="data-mono text-text-3">—</span>}
      </td>
      {/* Bookmark */}
      <td className="border-b border-l border-line px-3 py-3 text-center">
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
      </td>
    </>
  )

  return (
    <div className={teaser ? 'pointer-events-none select-none' : ''}>
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
              <th scope="col" className="min-w-[90px] border-b border-l border-line px-4 py-2.5 text-center overline-caption text-text-3">
                Edge
              </th>
              <th scope="col" className="w-12 border-b border-l border-line px-3 py-2.5" aria-label="Save" />
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
              <p className="data-mono mb-3 flex flex-wrap items-center gap-1.5 text-[12px] font-bold text-text-1">
                <Icon size={13} strokeWidth={1.5} className="text-sp-indigo" />
                {p.market} o{p.line}
                <span className="font-medium text-text-2">{formatOdds(consensusOver(p))}</span>
                {bestOverTag(p) && (
                  <span className="rounded-sm border border-sp-indigo/40 bg-sp-indigo/10 px-1 py-px text-[9px] font-semibold tracking-wide text-sp-indigo">
                    best {bestOverTag(p)}
                  </span>
                )}
                {!hasRealOdds(p) && p.sport === 'nhl' && (
                  <span className="text-[9px] font-normal text-text-3/70">no odds feed</span>
                )}
              </p>
              <div className="grid grid-cols-3 gap-3">
                {HIT_WINDOWS.map((w) => (
                  <div key={w}>
                    <span className="overline-caption mb-1 block text-[9px] text-text-3">{w}</span>
                    <HitBar rate={p.hitRates[w]} windowKey={w} primary={w === window} rowIndex={i} resetKey={resetKey} />
                  </div>
                ))}
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {drawerProp && <PropDrawer prop={drawerProp} onClose={() => setDrawerProp(null)} />}
      </AnimatePresence>
    </div>
  )
}
