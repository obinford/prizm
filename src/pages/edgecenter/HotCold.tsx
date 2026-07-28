// Hot / Cold Batters — Step 11.2. Rank-ordered matchup cards from
// trpc.brief.hotCold: the batter's season vs-hand split against tonight's
// probable starter's reciprocal split.
//
// Honesty rules carried from the router:
// - The split shown is the SEASON vs-hand row — sv_stat_cache does not cross
//   the l30 window with hand, and the card says which split it carries.
// - No OPS: OBP is not in the warehouse, so cards show AVG / xwOBA / K%.
// - The PA count is on every card — sample size is part of the rank.

import { motion } from 'framer-motion'
import { Flame, Snowflake } from 'lucide-react'
import { trpc } from '@/providers/trpc'

const QUERY_OPTS = { staleTime: 5 * 60_000, retry: 1 } as const

type Card = {
  rank: number
  batter: string
  team: string
  matchup: string
  splitLabel: string
  pa: number
  avg: number | null
  xwoba: number | null
  kPct: number | null
  oppSp: string
  oppSpHand: 'L' | 'R'
  oppSpSplit: string | null
}

function fmtRate(v: number | null): string {
  return v == null ? '—' : v.toFixed(3).replace(/^0/, '')
}

function MatchupCard({ card, tone }: { card: Card; tone: 'hot' | 'cold' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.35 }}
      className="prizm-card p-4"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={`data-mono flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
            tone === 'hot' ? 'bg-sp-orange/15 text-sp-orange' : 'bg-sp-cyan/15 text-sp-cyan'
          }`}
        >
          {card.rank}
        </span>
        <span className="truncate text-[13px] font-semibold text-text-1">{card.batter}</span>
        <span className="data-mono shrink-0 text-[11px] text-text-3">{card.team}</span>
      </div>
      <p className="data-mono mb-1.5 text-[11px] text-text-3">{card.matchup}</p>
      <p className="data-mono text-[12px] text-text-1">
        {card.splitLabel}: {fmtRate(card.avg)} AVG / {fmtRate(card.xwoba)} xwOBA /{' '}
        {card.kPct == null ? '—' : `${card.kPct.toFixed(1)}%`} K
      </p>
      <p className="data-mono mt-0.5 text-[11px] text-text-3">{card.pa} PA in this split</p>
      <p className="data-mono mt-1.5 border-t border-line pt-1.5 text-[11px] text-text-2">
        Opp SP: {card.oppSp} ({card.oppSpHand}HP)
        {card.oppSpSplit ? ` — ${card.oppSpSplit}` : ' — no split row for this side'}
      </p>
    </motion.div>
  )
}

function Block({
  title,
  icon,
  cards,
  tone,
  empty,
}: {
  title: string
  icon: React.ReactNode
  cards: Card[]
  tone: 'hot' | 'cold'
  empty: string
}) {
  return (
    <div>
      <p className="overline-caption mb-2 flex items-center gap-1.5 text-text-3">
        {icon}
        {title}
      </p>
      {cards.length === 0 ? (
        <p className="rounded-md border border-dashed border-line bg-bg-2/50 px-3 py-3 text-[12px] text-text-3">
          {empty}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <MatchupCard key={`${tone}-${c.rank}`} card={c} tone={tone} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function HotCold() {
  const hotColdQuery = trpc.brief.hotCold.useQuery(undefined, QUERY_OPTS)
  const data = hotColdQuery.data

  if (hotColdQuery.isLoading) {
    return (
      <section className="mb-10">
        <p className="overline-caption mb-3 text-text-3">Hot / cold batters</p>
        <div className="prizm-card p-5 text-[13px] text-text-3">Ranking tonight's matchups…</div>
      </section>
    )
  }

  if (hotColdQuery.isError || !data) {
    return (
      <section className="mb-10">
        <p className="overline-caption mb-3 text-text-3">Hot / cold batters</p>
        <p className="rounded-md border border-dashed border-line bg-bg-2/50 px-3 py-3 text-[12px] text-text-3">
          Hot/cold ranks failed to load
          {hotColdQuery.error ? ` — ${hotColdQuery.error.message}` : ''}. Nothing is substituted.
        </p>
      </section>
    )
  }

  const emptyWhy =
    'No qualified matchups — a batter needs at least 10 PA in the season vs-hand split against a probable starter with a known hand.'

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="mb-10 space-y-5"
    >
      <div>
        <p className="overline-caption mb-1 text-text-3">Hot / cold batters</p>
        <p className="data-mono text-[11px] text-text-3">
          Season vs-hand splits from the Statcast warehouse · ranked by xwOBA ·{' '}
          {data.considered} qualified matchups (min 10 PA) · no OPS — OBP is not warehoused, so
          cards carry AVG / xwOBA / K%
        </p>
      </div>
      <Block
        title="Hot"
        icon={<Flame size={13} className="text-sp-orange" />}
        cards={data.hot}
        tone="hot"
        empty={emptyWhy}
      />
      <Block
        title="Cold"
        icon={<Snowflake size={13} className="text-sp-cyan" />}
        cards={data.cold}
        tone="cold"
        empty={emptyWhy}
      />
    </motion.section>
  )
}
