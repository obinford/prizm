// Pitcher detail drawer (dashboard.md §S6): season line chips, K%-by-window
// bar chart vs season baseline, split breakdown, tonight's matchup, actions.

import { useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, BookmarkPlus, X } from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { MLB_WINDOW_KEYS, MLB_WINDOW_LABELS } from '@/data/mlbPlayers'
import { deltaPct, deltaTextClass, formatDelta, heatCell, heatSolid } from '@/lib/heat'
import { fmtRate, fmtSvPct, svSplitChips } from '@/lib/savant'
import type { SplitKey, StarterEntry } from './utils'
import { fmtEra, fmtPct, fmtWhip, splitSample, splitStat, splitWindowStat } from './utils'
import { AnglePopover } from './angles'
import { addToAngle } from './angleStore'

export interface PitcherDrawerProps {
  entry: StarterEntry | null
  split: SplitKey | undefined
  onClose: () => void
  onToast: (msg: string) => void
}

export default function PitcherDrawer({ entry, split, onClose, onToast }: PitcherDrawerProps) {
  const [angleOpen, setAngleOpen] = useState(false)

  const p = entry?.pitcher
  // Real season/split values only. null => no source for this split (see
  // splitStat in ./utils) and the UI renders an em-dash instead of a number.
  const seasonK = p ? splitStat(p, split, 'kPct') : null
  const seasonEra = p ? splitStat(p, split, 'era') : null
  const seasonWhip = p ? splitStat(p, split, 'whip') : null
  const seasonBb = p ? splitStat(p, split, 'bbPct') : null
  const splitTbf = p ? splitSample(p, split) : null
  const DASH = '—'

  const chartData =
    p &&
    MLB_WINDOW_KEYS.map((w) => {
      // sv has no window x split cross-section, so an active split zeroes the
      // rolling chart rather than plotting invented values.
      const value = splitWindowStat(p, w, split, 'kPct')
      return {
        window: MLB_WINDOW_LABELS[w].replace(' PA', ''),
        k: value == null ? null : +(value * 100).toFixed(1),
        dPct: value == null || seasonK == null ? 0 : deltaPct(value, seasonK),
      }
    })

  // Real sv split chips (vs L / vs R / Home / Away) when the Statcast warehouse
  // covers this pitcher; legacy MySQL-derived chips otherwise. sv split kPct is
  // 0–100 — compared against the season legacy kPct ×100.
  // Real sv split chips (vs L / vs R / Home / Away). When the Statcast
  // warehouse does not cover this pitcher there is no second-best source, so
  // the section renders an explicit empty state rather than a synthetic one.
  const realSplits = p ? svSplitChips(p.splits) : []
  const splits =
    p &&
    realSplits.map(({ label, line }) => {
      const k100 = line.kPct ?? null
      const xw = line.xwoba ?? null
      return {
        label,
        kText: k100 != null ? fmtSvPct(k100) : xw != null ? `xwOBA ${fmtRate(xw)}` : '—',
        dPct: k100 != null ? deltaPct(k100, p.kPct * 100) : 0,
        sample: line.pa ?? null,
      }
    })

  const saveAngle = (angleId: string | null, newName?: string) => {
    if (!entry) return
    addToAngle(angleId, newName, {
      id: entry.pitcher.id,
      kind: 'mlb-pitcher',
      label: entry.pitcher.name,
      meta: `${entry.pitcher.team} · ${entry.pitcher.throws}HP vs ${entry.opp}`,
    })
    setAngleOpen(false)
    onToast('Added to angle')
  }

  return (
    <AnimatePresence>
      {entry && p && chartData && splits && (
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
            aria-label={`${p.name} details`}
          >
            {/* Header */}
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="font-display text-xl font-semibold text-text-1">{p.name}</h3>
                <p className="data-mono mt-0.5 text-[11px] text-text-3">
                  {p.team} · {p.throws}HP · vs {entry.opp} ({entry.homeAway})
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

            {/* Season line chips (+ real Statcast chips when covered) */}
            {split && (
              <p className="data-mono mb-2 text-[11px] text-text-3">
                {splitTbf != null
                  ? `Split view · real Statcast, ${splitTbf} BF. ERA and WHIP have no split source and show —.`
                  : 'Split view · no Statcast split coverage for this pitcher — values show —.'}
              </p>
            )}
            <div className="mb-6 flex flex-wrap gap-2">
              {(
                [
                  ['ERA', seasonEra == null ? DASH : fmtEra(seasonEra), false],
                  ['WHIP', seasonWhip == null ? DASH : fmtWhip(seasonWhip), false],
                  ['K%', seasonK == null ? DASH : fmtPct(seasonK), false],
                  ['BB%', seasonBb == null ? DASH : fmtPct(seasonBb), false],
                  ...(p.barrelPct != null ? [['Barrel%', fmtSvPct(p.barrelPct), true] as [string, string, boolean]] : []),
                  ...(p.hardHitPct != null ? [['HH%', fmtSvPct(p.hardHitPct), true] as [string, string, boolean]] : []),
                ] as [string, string, boolean][]
              ).map(([label, value, sv]) => (
                <span
                  key={label}
                  className="rounded-sm border border-line bg-bg-2 px-2.5 py-1.5"
                  style={{ backgroundColor: sv ? 'rgba(34,211,238,0.08)' : 'rgba(99,102,241,0.08)' }}
                  title={sv ? 'Real Statcast' : undefined}
                >
                  <span className="overline-caption mr-1.5 text-text-3">{label}</span>
                  <span className="data-mono text-[13px] font-semibold text-text-1">{value}</span>
                </span>
              ))}
            </div>

            {/* K% by window vs season baseline */}
            <p className="overline-caption mb-2 text-text-3">K% by window vs season</p>
            <div className="mb-6 rounded-md border border-line bg-bg-2/50 p-3">
              <div style={{ width: '100%', height: 176 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
                    <XAxis
                      dataKey="window"
                      tick={{ fill: '#5C6488', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      axisLine={{ stroke: 'rgba(148,163,255,0.10)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#5C6488', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, 'dataMax + 4']}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(148,163,255,0.06)' }}
                      contentStyle={{
                        background: '#12152A',
                        border: '1px solid rgba(148,163,255,0.22)',
                        borderRadius: 6,
                        fontFamily: 'JetBrains Mono',
                        fontSize: 12,
                      }}
                      labelStyle={{ color: '#9AA3C7' }}
                      formatter={(value) => [`${value}%`, 'K%']}
                    />
                    <ReferenceLine
                      y={seasonK == null ? 0 : +(seasonK * 100).toFixed(1)}
                      stroke="#5C6488"
                      strokeDasharray="4 4"
                      label={{
                        value: 'Season',
                        position: 'insideTopRight',
                        fill: '#5C6488',
                        fontSize: 10,
                        fontFamily: 'JetBrains Mono',
                      }}
                    />
                    <Bar dataKey="k" radius={[3, 3, 0, 0]} isAnimationActive animationDuration={400}>
                      {chartData.map((d) => (
                        <Cell key={d.window} fill={heatSolid(d.dPct)} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Split breakdown — real sv splits when covered */}
            <p className="overline-caption mb-2 text-text-3">
              Split breakdown
              {realSplits.length > 0 && (
                <span className="data-mono ml-2 rounded-sm border border-sp-cyan/40 bg-sp-cyan/10 px-1 py-px text-[8px] font-bold tracking-widest text-sp-cyan">
                  STCAST
                </span>
              )}
            </p>
            <div className="mb-6 space-y-2">
              {splits.length === 0 && (
                <p className="rounded-md border border-dashed border-line bg-bg-2/50 px-3 py-3 text-[12px] text-text-3">
                  No Statcast split coverage for this pitcher. Splits are shown only when
                  sv_stat_cache has a vs-L / vs-R / Home / Away row — they are never estimated.
                </p>
              )}
              {splits.map((s, i) => {
                const { background, textClass } = heatCell(s.dPct)
                return (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
                    className="flex items-center justify-between rounded-md border border-line bg-bg-2 px-3 py-2.5"
                  >
                    <span className="text-[13px] font-medium text-text-2">{s.label}</span>
                    <span
                      className="data-mono rounded-sm px-2 py-1 text-[12px] font-semibold"
                      style={{ backgroundColor: background }}
                    >
                      <span className={textClass}>{s.kText.startsWith('xwOBA') ? s.kText : `K ${s.kText}`}</span>
                      <span className={`ml-1.5 text-[10px] ${deltaTextClass(s.dPct)}`}>
                        {formatDelta(s.dPct, 1)}%
                      </span>
                      {s.sample != null && (
                        <span className="ml-1.5 text-[10px] text-text-3">over {s.sample} BF</span>
                      )}
                    </span>
                  </motion.div>
                )
              })}
            </div>

            {/* Tonight's matchup */}
            <p className="overline-caption mb-2 text-text-3">Tonight's matchup</p>
            <div className="mb-6 rounded-md border border-line bg-bg-2 px-3 py-3">
              <p className="data-mono text-[12px] text-text-1">
                {entry.homeAway === 'Home' ? `vs ${entry.opp}` : `@ ${entry.opp}`} ·{' '}
                {entry.game.startTime} · {entry.game.venue}
              </p>
              {entry.game.total !== undefined && (
                <p className="data-mono mt-1 text-[11px] text-text-3">O/U {entry.game.total}</p>
              )}
              {entry.game.note && <p className="mt-1 text-[12px] text-text-2">{entry.game.note}</p>}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Link
                to="/profiler"
                className="flex items-center gap-1.5 rounded-md bg-sp-indigo px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110"
              >
                Open in Profiler <ArrowRight size={14} />
              </Link>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAngleOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-md border border-line bg-bg-2 px-4 py-2.5 text-sm font-medium text-text-1 transition-colors hover:bg-bg-3"
                >
                  <BookmarkPlus size={14} /> Add to angle
                </button>
                <AnimatePresence>
                  {angleOpen && <AnglePopover onPick={saveAngle} onClose={() => setAngleOpen(false)} />}
                </AnimatePresence>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
