// Pricing comparison table — feature rows × both plans, check / em-dash marks.
// Rows come from plans.ts so the cards and the table never drift apart.

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { COMPARISON_ROWS, PLANS } from '@/pages/pricing/plans'

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

function Mark({ yes }: { yes: boolean }) {
  return yes ? (
    <Check size={16} strokeWidth={2} className="mx-auto text-sp-cyan" aria-label="Included" />
  ) : (
    <span className="text-text-3" aria-label="Not included">
      —
    </span>
  )
}

export default function ComparisonTable() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-bg-1">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-bg-2">
            <th
              scope="col"
              className="data-mono border-b border-line px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-text-3"
            >
              Feature
            </th>
            {PLANS.map((p) => (
              <th
                key={p.id}
                scope="col"
                className="data-mono w-28 border-b border-l border-line px-4 py-3 text-center text-[11px] font-medium uppercase tracking-wider text-text-3"
              >
                {p.id === 'allaccess' ? (
                  <span className="text-spectrum">{p.name}</span>
                ) : (
                  p.name
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map((row, i) => (
            <motion.tr
              key={row.label}
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.3, delay: i * 0.04, ease: EASE }}
              className="transition-colors hover:bg-bg-2/60"
            >
              <td className="border-b border-line px-5 py-3 text-[13px] text-text-2">
                {row.label}
                {row.note && (
                  <span className="data-mono ml-2 rounded-sm bg-bg-2 px-1.5 py-0.5 text-[10px] text-text-3">
                    {row.note}
                  </span>
                )}
              </td>
              <td className="border-b border-l border-line px-4 py-3 text-center">
                <Mark yes={row.dashboards} />
              </td>
              <td className="border-b border-l border-line px-4 py-3 text-center">
                <Mark yes={row.allaccess} />
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
      <p className="data-mono border-t border-line px-5 py-2.5 text-[11px] text-text-3">
        Every plan starts with the 7-day trial — $0 today, cancel anytime.
      </p>
    </div>
  )
}
