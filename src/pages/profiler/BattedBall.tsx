// Profiler S3c — Batted Ball (MLB) / Shot Profile (NHL): rolling 10-game rate
// line (indigo) vs season-average dashed line + stacked spray/shot-mix micro-bars
// (indigo / cyan / magenta). Legend chips toggle series (fade 250ms).

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { trendSeries, type AnyPlayer } from '@/pages/profiler/derive'

const SERIES_COLORS = { line: '#6366F1', a: '#6366F1', b: '#22D3EE', c: '#F472B6' }

interface ChartTooltipProps {
  active?: boolean
  label?: number
  payload?: Array<{ dataKey?: string | number; value?: number }>
}

function ChartTooltip({ active, label, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const rate = payload.find((p) => p.dataKey === 'rate')?.value
  const a = payload.find((p) => p.dataKey === 'a')?.value
  const b = payload.find((p) => p.dataKey === 'b')?.value
  const c = payload.find((p) => p.dataKey === 'c')?.value
  return (
    <div className="rounded-md border border-line bg-bg-2 px-3 py-2 shadow-raised">
      <p className="data-mono text-[11px] uppercase tracking-wider text-text-3">Game {label}</p>
      {rate !== undefined && (
        <p className="data-mono mt-1 text-[13px] font-semibold text-text-1">
          {rate.toFixed(1)} <span className="text-[10px] font-normal text-text-3">rolling rate</span>
        </p>
      )}
      {a !== undefined && b !== undefined && c !== undefined && (
        <p className="data-mono mt-0.5 text-[11px] text-text-2">
          {(a * 100).toFixed(0)} / {(b * 100).toFixed(0)} / {(c * 100).toFixed(0)} mix
        </p>
      )}
    </div>
  )
}

export default function BattedBall({ player }: { player: AnyPlayer }) {
  const series = useMemo(() => trendSeries(player), [player])
  const [showLine, setShowLine] = useState(true)
  const [showMix, setShowMix] = useState(true)

  const chipCls = (on: boolean) =>
    `data-mono flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-250 ${
      on ? 'border-line-strong bg-bg-2 text-text-1' : 'border-line bg-bg-1 text-text-3 opacity-60'
    }`

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg border border-line bg-bg-1 p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-base font-semibold text-text-1">{series.metric}</h3>
        <span className="data-mono text-[11px] text-text-3">rolling 10-game · season avg {series.seasonAvg}</span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setShowLine((v) => !v)} className={chipCls(showLine)}>
            <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS.line }} />
            {series.metric}
          </button>
          <button type="button" onClick={() => setShowMix((v) => !v)} className={chipCls(showMix)}>
            <span className="flex h-2 w-4 overflow-hidden rounded-full">
              <span className="h-full flex-1" style={{ background: SERIES_COLORS.a }} />
              <span className="h-full flex-1" style={{ background: SERIES_COLORS.b }} />
              <span className="h-full flex-1" style={{ background: SERIES_COLORS.c }} />
            </span>
            {series.mixLabels.join(' / ')}
          </button>
        </div>
      </div>

      <div className="mt-4 h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series.points} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
            <CartesianGrid stroke="rgba(148,163,255,0.06)" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="game"
              tick={{ fill: 'var(--text-3)', fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--line)' }}
            />
            <YAxis
              yAxisId="rate"
              tick={{ fill: 'var(--text-3)', fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <YAxis yAxisId="mix" hide domain={[0, 1]} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(148,163,255,0.2)' }} />
            <ReferenceLine
              yAxisId="rate"
              y={series.seasonAvg}
              stroke="var(--text-3)"
              strokeDasharray="5 4"
              label={{
                value: 'season avg',
                position: 'insideTopRight',
                fill: 'var(--text-3)',
                fontSize: 10,
                fontFamily: '"JetBrains Mono", monospace',
              }}
            />
            {showMix && (
              <>
                <Bar yAxisId="mix" dataKey="a" stackId="mix" fill={SERIES_COLORS.a} fillOpacity={0.55} isAnimationActive animationDuration={400} name={series.mixLabels[0]} />
                <Bar yAxisId="mix" dataKey="b" stackId="mix" fill={SERIES_COLORS.b} fillOpacity={0.55} isAnimationActive animationDuration={400} name={series.mixLabels[1]} />
                <Bar yAxisId="mix" dataKey="c" stackId="mix" fill={SERIES_COLORS.c} fillOpacity={0.55} isAnimationActive animationDuration={400} radius={[3, 3, 0, 0]} name={series.mixLabels[2]} />
              </>
            )}
            {showLine && (
              <Line
                yAxisId="rate"
                type="monotone"
                dataKey="rate"
                stroke={SERIES_COLORS.line}
                strokeWidth={2.5}
                dot={false}
                isAnimationActive
                animationDuration={1200}
                name={series.metric}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
