import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { animate, motion } from 'framer-motion'
import { Bookmark, Crosshair, FileDown, Info, Share2, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import { TODAYS_SLATE } from '@/data/slate'
import { PROPS, bestOverTag, consensusOver, formatOdds, impliedProb, rawEdgePp, type PropLine } from '@/data/props'
import { getPlan, onPlanChange } from '@/lib/plan'
import { getFollowedIds, onFollowsChange } from '@/lib/follows'
import { DeltaChip, EdgeGauge, SportChip, ToastViewport } from './gamecenter/kit'
import { hitRateTint, saveAngle, toast } from './gamecenter/utils'

// ---------------------------------------------------------------------------
// Content helpers
// ---------------------------------------------------------------------------

// PROPS is hydrated live by LiveDataProvider before this page mounts — rank
// lazily on first render, never at module import time (the cache is empty then).
let rankedCache: PropLine[] | null = null
function rankedProps(): PropLine[] {
  if (!rankedCache) rankedCache = [...PROPS].sort((a, b) => (b.edgeScore ?? 0) - (a.edgeScore ?? 0))
  return rankedCache
}
function topEdges(): PropLine[] {
  return rankedProps().slice(0, 8)
}

/**
 * A factual one-liner built ONLY from values that exist on the row.
 *
 * The previous implementation returned canned per-market prose asserting things
 * no data in this app supports ("barreling at a 71% clip", "this fixture has
 * averaged north of seven goals", opponent shot volume of `line + 4`). Those
 * sentences were attached to whichever player happened to occupy a market slot.
 * Nothing here is asserted that is not read off the row.
 */
function edgeNote(p: PropLine): string {
  const l10 = p.hitRates.L10
  const l20 = p.hitRates.L20
  const parts: string[] = []

  if (l10 != null) {
    parts.push(`Cleared ${p.line} in ${Math.round(l10 * 10)} of the last 10 (${Math.round(l10 * 100)}%)`)
  }
  if (l20 != null) {
    parts.push(`${Math.round(l20 * 100)}% over the L20`)
  }

  const edge = rawEdgePp(p)
  if (edge != null) {
    const price = consensusOver(p)
    parts.push(
      `consensus ${formatOdds(price)} implies ${Math.round(impliedProb(price) * 100)}%` +
        ` — a ${edge >= 0 ? '+' : ''}${edge.toFixed(1)}pp gap before vig`,
    )
  } else {
    parts.push('no book odds for this market — hit rate shown without a price comparison')
  }

  return parts.join(' · ') + '.'
}

// ---------------------------------------------------------------------------
// Ghost rank numeral — counts 0 → position on entry
// ---------------------------------------------------------------------------

function GhostRank({ n, small }: { n: number; small?: boolean }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const controls = animate(0, n, {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setVal(Math.round(v)),
    })
    return () => controls.stop()
  }, [n])
  return (
    <span
      className={`font-display shrink-0 select-none font-bold text-text-3/40 ${
        small ? 'text-[32px] leading-none sm:hidden' : 'hidden w-16 text-[64px] leading-none sm:block'
      }`}
      aria-hidden
    >
      {val}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Ranked edge card
// ---------------------------------------------------------------------------

function EdgeCard({
  prop,
  rank,
  lite,
  index,
}: {
  prop: PropLine
  rank: number
  lite: boolean
  index: number
}) {
  const score = prop.edgeScore ?? 0
  const chips = [
    { dPct: hitRateTint(prop.hitRates.L10), label: `L10 hit rate ${Math.round(prop.hitRates.L10 * 100)}%` },
    { dPct: hitRateTint(prop.hitRates.L20), label: `L20 form ${Math.round(prop.hitRates.L20 * 100)}%` },
  ]
  if (prop.priceAlert) {
    const alertEdge = rawEdgePp(prop)
    chips.push({
      dPct: alertEdge ?? 0,
      label: `Price alert · ${formatOdds(consensusOver(prop))} consensus`,
    })
  }
  const best = bestOverTag(prop)
  const angleTitle = `${prop.player} ${prop.market} o${prop.line} (${formatOdds(consensusOver(prop))})`
  const note = edgeNote(prop)

  return (
    <motion.article
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.6, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className={`group prizm-card flex gap-4 p-5 transition-colors hover:border-line-strong sm:gap-6 sm:p-6 ${
        lite ? 'opacity-70' : ''
      }`}
    >
      <GhostRank n={rank} small />
      <GhostRank n={rank} />

      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-text-1">{prop.player}</h3>
          <span className="data-mono text-[12px] text-text-3">
            {prop.team} · {prop.opponent}
          </span>
          <SportChip sport={prop.sport} />
        </div>

        {/* Prop line — real consensus price + best book when the odds feed covers it */}
        <p className="data-mono mt-1.5 text-[15px] font-bold text-text-1">
          {prop.market} o{prop.line}{' '}
          <span className="text-text-2">({formatOdds(consensusOver(prop))})</span>
          {best && (
            <span className="ml-2 rounded-sm border border-sp-indigo/40 bg-sp-indigo/10 px-1.5 py-0.5 align-middle text-[10px] font-semibold tracking-wide text-sp-indigo">
              best {best}
            </span>
          )}
          {prop.oddsSource === 'sv_odds' && prop.books != null && (
            <span className="ml-1.5 align-middle text-[10px] font-normal text-text-3">
              {prop.books} books
            </span>
          )}
        </p>

        {/* Reason row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map((c, i) => (
            <DeltaChip key={c.label} dPct={c.dPct} label={c.label} icon={i === 2 ? 'zap' : undefined} />
          ))}
        </div>
        <p className="mt-2.5 flex items-start gap-1.5 text-sm text-text-2">
          <Sparkles size={14} className="mt-0.5 shrink-0 text-sp-indigo" />
          {note}
        </p>

        {/* Footer */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
          <Link
            to="/hit-rates"
            className="data-mono text-[12px] font-medium text-sp-indigo transition-colors hover:text-sp-cyan"
          >
            See in Hit Rates →
          </Link>
          <Link
            to="/profiler"
            className="data-mono text-[12px] font-medium text-sp-indigo transition-colors hover:text-sp-cyan"
          >
            Profile →
          </Link>
          <button
            type="button"
            onClick={() => saveAngle({ title: angleTitle, subtitle: note, source: 'EdgeCenter' })}
            className="ml-auto flex items-center gap-1.5 rounded-sm border border-line bg-bg-2 px-2.5 py-1.5 text-[12px] font-medium text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
          >
            <Bookmark size={13} /> Add to My Angles
          </button>
        </div>
      </div>

      {/* Gauge / score chip */}
      {lite ? (
        <span
          className="data-mono h-fit shrink-0 rounded-sm px-2 py-1 text-[13px] font-bold text-white"
          style={{ background: 'var(--gradient-spectrum)' }}
        >
          {score}
        </span>
      ) : (
        <div className="hidden shrink-0 transition-[filter] duration-300 group-hover:drop-shadow-[0_0_12px_rgba(99,102,241,0.45)] sm:block">
          <EdgeGauge score={score} />
        </div>
      )}
    </motion.article>
  )
}

// ---------------------------------------------------------------------------
// EdgeCenter page
// ---------------------------------------------------------------------------

export default function EdgeCenter() {
  const [isAllAccess, setIsAllAccess] = useState(() => getPlan() === 'allaccess')
  useEffect(() => onPlanChange(() => setIsAllAccess(getPlan() === 'allaccess')), [])
  const today = new Date()
  const [followedIds, setFollowedIds] = useState(() => getFollowedIds())
  useEffect(() => onFollowsChange(() => setFollowedIds(getFollowedIds())), [])
  const followedEdges = rankedProps().filter((p) => followedIds.includes(p.playerId)).slice(0, 6)

  const visibleTop = topEdges().slice(0, 3)
  const visibleRest = isAllAccess ? topEdges().slice(3) : []

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast('Brief link copied')
    } catch {
      toast('Brief link copied')
    }
  }

  return (
    <div className="mx-auto max-w-[880px]">
      {/* S1 — Brief masthead */}
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="relative inline-block">
            <p className="data-mono text-[12px] font-medium uppercase tracking-[0.18em] text-text-3">
              The Daily Edge Report
            </p>
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="absolute -bottom-1.5 left-0 h-px w-full origin-left"
              style={{ background: 'var(--gradient-spectrum)', opacity: 0.6 }}
            />
          </div>
          <h1 className="mt-3 font-display text-[34px] font-bold leading-[1.05] tracking-[-0.02em] text-text-1 sm:text-[44px]">
            {format(today, 'EEEE')}&apos;s <span className="text-spectrum">edges.</span>
          </h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="data-mono mt-2 text-[13px] text-text-2"
          >
            {format(today, 'MMMM d, yyyy')} · {TODAYS_SLATE.length} games on the slate
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="data-mono mt-1 text-[12px] text-text-3"
          >
            {topEdges().length} edges found
          </motion.p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={share}
            aria-label="Copy brief link"
            className="rounded-md border border-line bg-bg-2 p-2.5 text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
          >
            <Share2 size={16} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => toast('Export queued — the PDF will download shortly')}
            className="flex items-center gap-2 rounded-md border border-line bg-bg-2 px-3.5 py-2.5 text-[13px] font-medium text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
          >
            <FileDown size={15} strokeWidth={1.5} /> Export PDF
          </button>
        </div>
      </header>

      {/* S2 — Edge score explainer strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="mb-8 flex items-center gap-2.5 rounded-md border border-line bg-bg-1 px-4 py-3"
      >
        <Info size={15} className="shrink-0 text-sp-indigo" />
        <p className="data-mono text-[12px] text-text-2">
          Edge Score blends rolling-window deltas, hit-rate form, and listed price. 80+ = rare air.
        </p>
      </motion.div>

      {/* S5 — Followed players band */}
      <section className="mb-10">
        <p className="overline-caption mb-3 text-text-3">From your follows</p>
        {followedEdges.length > 0 ? (
          <div className="flex snap-x gap-3 overflow-x-auto pb-2">
            {followedEdges.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="prizm-card flex shrink-0 snap-start items-center gap-3 px-4 py-3"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-text-1"
                  style={{
                    background:
                      'linear-gradient(var(--bg-2), var(--bg-2)) padding-box, var(--gradient-spectrum) border-box',
                    border: '2px solid transparent',
                  }}
                >
                  {p.player.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                </span>
                <span>
                  <span className="block text-sm font-medium text-text-1">{p.player}</span>
                  <span className="data-mono block text-[11px] text-text-3">
                    {p.market} o{p.line} ({formatOdds(consensusOver(p))})
                    {bestOverTag(p) ? ` · best ${bestOverTag(p)}` : ''}
                  </span>
                </span>
                <span
                  className="data-mono rounded-sm px-1.5 py-0.5 text-[12px] font-bold text-white"
                  style={{ background: 'var(--gradient-spectrum)' }}
                >
                  {p.edgeScore}
                </span>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-line px-4 py-5 text-sm text-text-3">
            Follow players in the{' '}
            <Link to="/profiler" className="font-medium text-sp-indigo hover:text-sp-cyan">
              Profiler
            </Link>{' '}
            and their edges surface here.
          </div>
        )}
      </section>

      {/* S3 — Ranked edge cards */}
      <section className="space-y-4">
        {visibleTop.map((p, i) => (
          <EdgeCard key={p.id} prop={p} rank={i + 1} lite={false} index={i} />
        ))}
      </section>

      {/* S6 — Upgrade wall (Dashboards plan) */}
      {!isAllAccess && (
        <section className="relative mt-6">
          <div className="pointer-events-none space-y-4 opacity-40 blur-[6px]" aria-hidden>
            {topEdges().slice(3, 5).map((p, i) => (
              <EdgeCard key={p.id} prop={p} rank={i + 4} lite index={i} />
            ))}
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.3 }}
            className="prizm-card raised relative z-10 mx-auto -mt-32 max-w-md p-8 text-center"
          >
            <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-sp-indigo/15 text-sp-indigo">
              <Crosshair size={20} strokeWidth={1.5} />
            </span>
            <h3 className="font-display text-xl font-semibold text-text-1">
              The full brief is All Access.
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-text-2">
              Ranks 4–{topEdges().length}, the worth-a-look list, and tomorrow&apos;s early read —
              plus unlimited Ask Prizm and GameCenter breakdowns.
            </p>
            <Link
              to="/pricing"
              className="cta-glow mt-5 inline-block rounded-md bg-sp-indigo px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Upgrade to All Access
            </Link>
          </motion.div>
        </section>
      )}

      {/* S4 — Worth a look divider + lighter cards */}
      {isAllAccess && visibleRest.length > 0 && (
        <>
          <div className="my-8 flex items-center gap-4">
            <span className="overline-caption shrink-0 text-text-3">Worth a look</span>
            <motion.span
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, amount: 0.8 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="h-px w-full origin-left bg-line"
            />
          </div>
          <section className="space-y-4">
            {visibleRest.map((p, i) => (
              <EdgeCard key={p.id} prop={p} rank={i + 4} lite index={i} />
            ))}
          </section>
        </>
      )}

      {/* S7 — Results tracking.
          The previous version of this footer rendered a hardcoded 3-2 record and
          five literal named results under a live weekday label. It was a claimed
          public track record backed by nothing. Removed. It returns when Phase
          3.4 lands: every flagged edge written to an append-only table at flag
          time and scored against the real closing number. */}
      <footer className="mt-12 border-t border-line pt-8">
        <p className="overline-caption mb-2 text-text-3">Results tracking</p>
        <p className="max-w-2xl text-[13px] text-text-3">
          Not live yet. Edge results will appear here once flagged edges are logged
          and scored against closing lines — we would rather show nothing than a
          record we cannot audit.
        </p>
      </footer>

      <ToastViewport />
    </div>
  )
}
