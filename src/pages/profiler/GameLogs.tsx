// Profiler S3a — Game Logs: last 15 games with per-game prop hit/miss dots.
// Red dot = hit the over, blue dot = under (design.md §2.4 semantics).

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { gameLogs, type AnyPlayer } from '@/pages/profiler/derive'

export default function GameLogs({ player }: { player: AnyPlayer }) {
  const table = useMemo(() => gameLogs(player), [player])
  const [hoverRow, setHoverRow] = useState<number | null>(null)

  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-bg-1">
      {/* Hover tooltip — full line */}
      {hoverRow !== null && table.rows[hoverRow] && (
        <div className="pointer-events-none absolute right-3 top-2.5 z-20 hidden rounded-sm border border-line bg-bg-2 px-3 py-1.5 shadow-raised md:block">
          <span className="data-mono text-[11px] text-text-1">{table.rows[hoverRow].line}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-bg-2">
              <th scope="col" className="data-mono border-b border-line px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-text-3">
                Date
              </th>
              <th scope="col" className="data-mono border-b border-line px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-text-3">
                Opp
              </th>
              {table.columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className="data-mono border-b border-l border-line px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-wider text-text-3"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <motion.tr
                key={`${row.date}-${i}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.02 }}
                onMouseEnter={() => setHoverRow(i)}
                onMouseLeave={() => setHoverRow(null)}
                className="transition-colors hover:bg-bg-3"
              >
                <td className="data-mono border-b border-line px-3 py-2 text-[13px] text-text-2">{row.date}</td>
                <td className="border-b border-line px-3 py-2">
                  <span
                    className={`data-mono rounded-sm px-1.5 py-0.5 text-[11px] font-semibold ${
                      row.home ? 'bg-sp-indigo/15 text-sp-indigo' : 'bg-bg-2 text-text-2'
                    }`}
                  >
                    {row.home ? 'vs' : '@'} {row.opp}
                  </span>
                </td>
                {row.cells.map((cell, ci) => (
                  <td key={cell.key} className="border-b border-l border-line px-3 py-1.5 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="data-mono text-[13px] font-medium text-text-1">{cell.text}</span>
                      {cell.dot ? (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.2, delay: i * 0.02 + ci * 0.01 }}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: cell.dot === 'over' ? '#EF4444' : '#3B82F6' }}
                          title={cell.dot === 'over' ? 'Hit the over' : 'Went under'}
                        />
                      ) : (
                        <span className="h-1.5 w-1.5" />
                      )}
                    </div>
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-4 border-t border-line px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-[11px] text-text-3">
          <span className="h-1.5 w-1.5 rounded-full bg-pos" /> hit over
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-text-3">
          <span className="h-1.5 w-1.5 rounded-full bg-neg" /> went under
        </span>
        <span className="data-mono ml-auto text-[11px] text-text-3">Last 15 games</span>
      </div>
    </div>
  )
}
