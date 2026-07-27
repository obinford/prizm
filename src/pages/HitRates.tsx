import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Gem, SlidersHorizontal } from 'lucide-react'
import ScannerControls from '@/pages/hit-rates/ScannerControls'
import type { ScannerState } from '@/pages/hit-rates/ScannerControls'
import ResultsTable from '@/pages/hit-rates/ResultsTable'
import type { SortDir } from '@/pages/hit-rates/ResultsTable'
import UpgradeWall from '@/pages/hit-rates/UpgradeWall'
import SummaryStrip from '@/pages/hit-rates/SummaryStrip'
import { saveAngle } from '@/pages/hockey/extras'
import { getProps, formatOdds } from '@/data/props'
import type { HitWindow, PropLine } from '@/data/props'
import { MLB_MARKETS, NHL_MARKETS } from '@/data/props'
import { getPlan, onPlanChange } from '@/lib/plan'
import type { Plan } from '@/lib/plan'

const FREE_ROWS = 5
const TEASER_ROWS = 3

export default function HitRates() {
  const [scanner, setScanner] = useState<ScannerState>({
    sport: 'mlb',
    markets: [],
    window: 'L10',
    minHit: 60,
    alertsOnly: false,
    search: '',
  })
  const [sortKey, setSortKey] = useState<HitWindow>('L10')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [plan, setPlan] = useState<Plan>(() => getPlan())
  const [toast, setToast] = useState<string | null>(null)
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set())
  const [controlsOpen, setControlsOpen] = useState(false)

  useEffect(() => onPlanChange(() => setPlan(getPlan())), [])

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
    return sportProps.filter(
      (p) =>
        (scanner.markets.length === 0 || scanner.markets.includes(p.market)) &&
        p.hitRates[scanner.window] * 100 >= scanner.minHit &&
        (!scanner.alertsOnly || p.priceAlert) &&
        (!q || p.player.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)),
    )
  }, [sportProps, scanner])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) =>
      sortDir === 'desc'
        ? b.hitRates[sortKey] - a.hitRates[sortKey]
        : a.hitRates[sortKey] - b.hitRates[sortKey],
    )
    return arr
  }, [filtered, sortKey, sortDir])

  const gated = plan === 'dashboards'
  const visibleRows = gated ? sorted.slice(0, FREE_ROWS) : sorted
  const teaserRows = gated ? sorted.slice(FREE_ROWS, FREE_ROWS + TEASER_ROWS) : []

  const resetKey = JSON.stringify([
    scanner.sport,
    scanner.markets,
    scanner.window,
    scanner.minHit,
    scanner.alertsOnly,
    scanner.search,
    plan,
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
      `${p.player} ${p.market} o${p.line}`,
      `${p.team} ${p.opponent} · ${formatOdds(p.overPrice)} · L10 ${Math.round(p.hitRates.L10 * 100)}%`,
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
  const top = [...filtered].sort((a, b) => b.hitRates[scanner.window] - a.hitRates[scanner.window])[0]
  const topLine = top
    ? `${top.player.split(' ').map((w, i) => (i === 0 ? `${w[0]}.` : w)).join(' ')} ${top.market} o${top.line} — ${Math.round(top.hitRates[scanner.window] * 100)}% ${scanner.window}`
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
                handleScanner({ sport: scanner.sport, markets: [], window: 'L10', minHit: 0, alertsOnly: false, search: '' })
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
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              onBookmark={onBookmark}
              bookmarked={bookmarked}
              resetKey={resetKey}
            />

            {/* S4 — upgrade wall (dashboards plan) */}
            {gated && (
              <div className="relative border-t border-line">
                {teaserRows.length > 0 && (
                  <>
                    <div className="pointer-events-none select-none opacity-50 blur-[3px]" aria-hidden>
                      <ResultsTable
                        rows={teaserRows}
                        window={scanner.window}
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={() => {}}
                        onBookmark={() => {}}
                        bookmarked={bookmarked}
                        resetKey={`${resetKey}-teaser`}
                        teaser
                      />
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-40 animate-pulse bg-gradient-to-b from-transparent via-bg-1/40 to-bg-1" />
                  </>
                )}
                <div className={`relative z-10 pb-8 pt-2 ${teaserRows.length > 0 ? '-mt-24' : ''}`}>
                  <UpgradeWall onUpgraded={() => setToast('Welcome to All Access')} />
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* S5 — summary strip */}
      <SummaryStrip alertsCount={alertsCount} topLine={topLine} onExport={exportCsv} />

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
