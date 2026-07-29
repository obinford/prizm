import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Construction, Gem, SlidersHorizontal } from 'lucide-react'
import ScannerControls from '@/pages/hit-rates/ScannerControls'
import type { ScannerState } from '@/pages/hit-rates/ScannerControls'
import ResultsTable from '@/pages/hit-rates/ResultsTable'
import type { SortDir } from '@/pages/hit-rates/ResultsTable'
import SummaryStrip from '@/pages/hit-rates/SummaryStrip'
import OddsFreshness from '@/components/OddsFreshness'
import { saveAngle } from '@/pages/angles/store'
import { getProps, formatOdds, sideRate } from '@/data/props'
import type { HitWindow, PropLine } from '@/data/props'
import { MLB_MARKETS, NHL_MARKETS } from '@/data/props'

// FIX 13: FREE_ROWS/TEASER_ROWS gating constants removed with the upgrade
// wall — every row renders for every visitor while pricing is deferred.

export default function HitRates() {
  const [scanner, setScanner] = useState<ScannerState>({
    sport: 'mlb',
    markets: [],
    window: 'L10',
    minHit: 60,
    alertsOnly: false,
    search: '',
    side: 'over',
    line: '',
    edgeWindow: 'L10',
  })
  const [sortKey, setSortKey] = useState<HitWindow>('L10')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [toast, setToast] = useState<string | null>(null)
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set())
  const [controlsOpen, setControlsOpen] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const handleScanner = (next: ScannerState) => {
    if (next.window !== scanner.window) {
      setSortKey(next.window)
      setSortDir('desc')
    }
    if (next.sport !== scanner.sport) next = { ...next, markets: [] }
    setScanner(next)
  }

  const sportProps = useMemo(() => getProps({ sport: scanner.sport }), [scanner.sport])
  const sportMarkets = scanner.sport === 'mlb' ? MLB_MARKETS : NHL_MARKETS

  const filtered = useMemo(() => {
    const q = scanner.search.trim().toLowerCase()
    // Exact-line filter: only applies when the input parses to a finite number;
    // partial or non-numeric text is ignored rather than silently matching nothing.
    const lineNum = scanner.line.trim() === '' ? null : Number(scanner.line.trim())
    return sportProps.filter(
      (p) =>
        (scanner.markets.length === 0 || scanner.markets.includes(p.market)) &&
        (lineNum == null || !Number.isFinite(lineNum) || p.line === lineNum) &&
        sideRate(p, scanner.window, scanner.side).rate * 100 >= scanner.minHit &&
        (!scanner.alertsOnly || p.priceAlert) &&
        (!q || p.player.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)),
    )
  }, [sportProps, scanner])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) =>
      sortDir === 'desc'
        ? sideRate(b, sortKey, scanner.side).rate - sideRate(a, sortKey, scanner.side).rate
        : sideRate(a, sortKey, scanner.side).rate - sideRate(b, sortKey, scanner.side).rate,
    )
    return arr
  }, [filtered, sortKey, sortDir, scanner.side])

  // FIX 13: gating removed with pricing deferred — every row is visible.
  const visibleRows = sorted

  const resetKey = JSON.stringify([
    scanner.sport,
    scanner.markets,
    scanner.window,
    scanner.minHit,
    scanner.alertsOnly,
    scanner.search,
    scanner.side,
    scanner.line,
    scanner.edgeWindow,
  ])

  const onSort = (key: HitWindow) => {
    if (key === sortKey) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const onBookmark = (p: PropLine) => {
    saveAngle(
      `${p.player} ${p.market} ${scanner.side === 'over' ? 'o' : 'u'}${p.line}`,
      `${p.team} ${p.opponent} · ${formatOdds(scanner.side === 'over' ? p.overPrice : p.underPrice)} · L10 ${Math.round(sideRate(p, 'L10', scanner.side).rate * 100)}% ${scanner.side}`,
      p.sport,
    )
    setBookmarked((s) => new Set(s).add(p.id))
    setToast('Angle added')
  }

  const exportCsv = () => {
    const header = 'player,team,opponent,market,line,over_price,under_price,L5,L10,L20,price_alert\n'
    const body = sorted
      .map((p) =>
        [
          p.player, p.team, `"${p.opponent}"`, p.market, p.line, p.overPrice, p.underPrice,
          p.hitRates.L5, p.hitRates.L10, p.hitRates.L20, p.priceAlert ? 1 : 0,
        ].join(','),
      )
      .join('\n')
    const blob = new Blob([header + body], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prizm-hit-rates-${scanner.sport}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setToast('CSV exported')
  }

  const alertsCount = filtered.filter((p) => p.priceAlert).length
  const top = [...filtered].sort(
    (a, b) => sideRate(b, scanner.window, scanner.side).rate - sideRate(a, scanner.window, scanner.side).rate,
  )[0]
  const topLine = top
    ? `${top.player.split(' ').map((w, i) => (i === 0 ? `${w[0]}.` : w)).join(' ')} ${top.market} ${scanner.side === 'over' ? 'o' : 'u'}${top.line} — ${Math.round(sideRate(top, scanner.window, scanner.side).rate * 100)}% ${scanner.window} ${scanner.side}`
    : null

  const controls = <ScannerControls state={scanner} onChange={handleScanner} />

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-8"
    >
      {/* S1 — page row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-wrap items-center gap-3"
      >
        <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-text-1">
          Prop hit-rate scanner
        </h2>
        <span className="data-mono rounded-sm border border-line bg-bg-2 px-2 py-1 text-[11px] text-text-2">
          {sportProps.length} props · {sportMarkets.length} markets
        </span>
        {scanner.sport === 'mlb' && <OddsFreshness />}

        {/* Sport segmented toggle */}
        <div
          className="ml-auto flex items-center rounded-full border border-line bg-bg-2 p-0.5"
          role="group"
          aria-label="Sport"
        >
          {(['mlb', 'nhl'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleScanner({ ...scanner, sport: s })}
              aria-pressed={scanner.sport === s}
              className={`data-mono relative inline-flex min-h-10 items-center justify-center rounded-full px-4 py-1.5 text-[12px] font-bold uppercase tracking-wide transition-colors ${
                scanner.sport === s ? 'text-sp-indigo' : 'text-text-3 hover:text-text-2'
              }`}
            >
              {scanner.sport === s && (
                <motion.span
                  layoutId="sport-pill"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  className="absolute inset-0 rounded-full bg-bg-3"
                />
              )}
              <span className="relative">{s}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setControlsOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-line bg-bg-2 px-3 py-2 text-[13px] font-medium text-text-1 transition-colors hover:bg-bg-3 sm:hidden"
        >
          <SlidersHorizontal size={14} strokeWidth={1.5} />
          Controls
        </button>
      </motion.div>

      {scanner.sport === 'nhl' ? (
        <NhlParkedPanel />
      ) : (
      <>
      {/* S2 — scanner controls (desktop) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="hidden sm:block"
      >
        {controls}
      </motion.div>

      {/* S3 — results */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="prizm-card overflow-hidden"
      >
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <Gem size={36} strokeWidth={1.5} className="text-text-3" />
            <p className="text-sm text-text-2">No props match these filters</p>
            <button
              type="button"
              onClick={() =>
                handleScanner({
                  sport: scanner.sport,
                  markets: [],
                  window: 'L10',
                  minHit: 0,
                  alertsOnly: false,
                  search: '',
                  side: 'over',
                  line: '',
                  edgeWindow: 'L10',
                })
              }
              className="rounded-md border border-line bg-bg-2 px-4 py-2.5 text-sm font-medium text-text-1 transition-colors hover:bg-bg-3"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <>
            <ResultsTable
              rows={visibleRows}
              window={scanner.window}
              side={scanner.side}
              edgeWindow={scanner.edgeWindow}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              onBookmark={onBookmark}
              bookmarked={bookmarked}
              resetKey={resetKey}
            />

            {/* S4 upgrade wall removed — FIX 13, pricing deferred. */}
          </>
        )}
      </motion.div>

      {/* S5 — summary strip */}
      <SummaryStrip alertsCount={alertsCount} topLine={topLine} onExport={exportCsv} />
      </>
      )}

      {/* Mobile controls bottom sheet */}
      {controlsOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 bg-[rgba(4,5,12,0.7)] backdrop-blur-[8px]"
            onClick={() => setControlsOpen(false)}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-xl border-t border-line bg-bg-1 p-4"
          >
            <div className="mb-4 flex items-center justify-between px-1">
              <h3 className="font-display text-lg font-semibold text-text-1">Scanner controls</h3>
              <button
                type="button"
                onClick={() => setControlsOpen(false)}
                className="rounded-md bg-sp-indigo px-4 py-2 text-sm font-semibold text-white"
              >
                Done
              </button>
            </div>
            {controls}
          </motion.div>
        </div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 overflow-hidden rounded-md border border-line bg-bg-2 py-3 pl-4 pr-5 shadow-raised"
            role="status"
          >
            <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: 'var(--gradient-spectrum)' }} />
            <span className="text-sm text-text-1">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}


/**
 * NHL hit-rate surface — gated (FIX 8, Step 10 pattern).
 *
 * NHL is a parked vertical, and the prop board was the one surface the
 * parking missed. Every NHL prop row was wrong in three ways at once, and
 * the server now excludes them by default (props.list is MLB-only unless a
 * caller explicitly asks for NHL). This panel replaces the scanner results
 * whenever the sport toggle sits on NHL — it names the gaps rather than
 * rendering an empty table that looks like a filter miss.
 *
 * Unparking is Oakley's call: it needs a real NHL odds feed, a current
 * slate, and in-season game logs — not a filter change.
 */
const NHL_GAPS = [
  'No NHL odds feed — sv_odds carries zero NHL rows, so every NHL "price" was the invented flat −115/−115 fallback',
  'The NHL slate is 2026-09-29 preseason — the games those props pointed at are two months away',
  'The hit rates came from a different season — NHL game logs end 2026-04-16',
]

function NhlParkedPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="prizm-card p-8"
    >
      <div className="mb-4 flex items-center gap-3">
        <Construction size={20} strokeWidth={1.5} className="text-sp-amber" />
        <h3 className="font-display text-lg font-semibold text-text-1">NHL prop hit rates</h3>
        <span className="data-mono rounded-sm border border-sp-amber/40 bg-sp-amber/10 px-1.5 py-px text-[10px] font-bold uppercase tracking-widest text-sp-amber">
          Parked
        </span>
      </div>

      <p className="mb-5 max-w-2xl text-sm leading-relaxed text-text-2">
        NHL is a parked vertical. It briefly stayed on this board by accident, and what it showed
        was wrong in three ways at once — so it comes down rather than sit here looking plausible:
      </p>

      <ul className="mb-5 max-w-2xl space-y-2">
        {NHL_GAPS.map((g) => (
          <li key={g} className="flex items-start gap-2 text-sm leading-relaxed text-text-2">
            <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-sp-amber" />
            {g}
          </li>
        ))}
      </ul>

      <p className="max-w-2xl text-sm leading-relaxed text-text-3">
        It returns when there is a real NHL odds feed, a current slate, and in-season game logs
        behind it. The MLB scanner is unaffected — every row there prices from sv_odds across
        multiple books.
      </p>
    </motion.div>
  )
}
