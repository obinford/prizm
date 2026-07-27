import { motion } from 'framer-motion'
import type { AskTable } from '@/data/askResponses'
import { deltaTextClass, heatBg } from '@/lib/heat'

/** Parse a signed delta string ('+18.3%' / '−7.0%' / '—') to a number. */
function parseDelta(v: string | number): number | null {
  if (typeof v === 'number') return null
  const s = v.replace('−', '-').replace('%', '').trim()
  if (s === '—' || s === '' || s === '+') return null
  const n = parseFloat(s)
  return Number.isNaN(n) ? null : n
}

/**
 * Embedded mini split table inside an Ask Prizm answer —
 * full Split Table styling at 12px scale with heat cells.
 */
export default function MiniTable({ table }: { table: AskTable }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-line">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-bg-2">
            {table.columns.map((c) => (
              <th
                key={c}
                scope="col"
                className="data-mono border-b border-line px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-3 first:pl-3.5"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <motion.tr
              key={ri}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: ri * 0.05 }}
              className="bg-bg-1 transition-colors hover:bg-bg-3/50"
            >
              {row.map((cell, ci) => {
                const d = table.heatColumn === ci ? parseDelta(cell) : null
                if (d !== null) {
                  return (
                    <motion.td
                      key={ci}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: ri * 0.05 + ci * 0.06 }}
                      className="border-b border-line px-3 py-2"
                      style={{ backgroundColor: heatBg(d) }}
                    >
                      <span className={`data-mono text-[12px] font-semibold ${deltaTextClass(d)}`}>
                        {cell}
                      </span>
                    </motion.td>
                  )
                }
                return (
                  <td key={ci} className="border-b border-line px-3 py-2 first:font-medium">
                    <span className={`data-mono text-[12px] ${ci === 0 ? 'text-text-1' : 'text-text-2'}`}>
                      {cell}
                    </span>
                  </td>
                )
              })}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
