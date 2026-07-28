// Watchlist — Step 11.4. Rows where edgeSurvivesCI() is true: the de-vigged
// edge clears its 95% Wilson interval on a market whose consensus has enough
// books and a coherent hold. No "AI" label, no fictional model name — the
// criterion is printed on the section and the empty state names the real
// reason nothing qualified.

import { motion } from 'framer-motion'
import { Eye } from 'lucide-react'
import { Link } from 'react-router'
import { PROPS, consensusOver, devigProp, edgePp, edgeSurvivesCI, formatOdds, bestOverTag } from '@/data/props'

export default function Watchlist() {
  // PROPS is hydrated before mount (LiveDataProvider gates the authed app).
  const rows = PROPS.filter((p) => edgeSurvivesCI(p) === true).slice(0, 12)

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="mb-10"
    >
      <p className="overline-caption mb-1 flex items-center gap-1.5 text-text-3">
        <Eye size={13} /> Watchlist
      </p>
      <p className="data-mono mb-3 text-[11px] text-text-3">
        Edges whose de-vigged edge clears the 95% confidence interval on a market with enough
        books and a coherent hold — nothing else gets in.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-line bg-bg-2/50 px-4 py-5 text-[13px] leading-relaxed text-text-3">
          Nothing on the watchlist tonight — no edge cleared its confidence interval on a market
          with enough books. That is a real answer, not a missing feed: the ranked list above shows
          the strongest edges that did not clear it.
        </p>
      ) : (
        <div className="flex snap-x gap-3 overflow-x-auto pb-2">
          {rows.map((p, i) => {
            const edge = edgePp(p)
            const fair = devigProp(p)
            const best = bestOverTag(p)
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
                className="prizm-card w-64 shrink-0 snap-start px-4 py-3"
              >
                <p className="truncate text-sm font-medium text-text-1">{p.player}</p>
                <p className="data-mono mt-0.5 text-[11px] text-text-3">
                  {p.team} · {p.opponent}
                </p>
                <p className="data-mono mt-1.5 text-[13px] font-bold text-text-1">
                  {p.market} o{p.line}{' '}
                  <span className="font-normal text-text-2">({formatOdds(consensusOver(p))})</span>
                  {best && <span className="ml-1 text-[10px] font-normal text-sp-indigo">best {best}</span>}
                </p>
                {edge != null && fair && (
                  <p className="data-mono mt-1 text-[11px] text-text-2">
                    Edge {edge >= 0 ? '+' : '−'}
                    {Math.abs(edge).toFixed(1)}pp vs fair {Math.round(fair.over * 100)}% · clears 95% CI
                  </p>
                )}
                <Link
                  to="/dashboard?tab=starters&view=hitrates"
                  className="data-mono mt-2 inline-block text-[11px] font-medium text-sp-indigo transition-colors hover:text-sp-cyan"
                >
                  See in Hit Rates →
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}
    </motion.section>
  )
}
