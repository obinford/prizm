import { useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { Bookmark, Check, Flame } from 'lucide-react'
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
import type { Goalie, Skater } from '@/data/nhlPlayers'
import { addAngle, shortDate, textSnapshot } from '@/pages/angles/store'
import { NHL_WINDOW_KEYS, NHL_WINDOW_LABELS } from '@/data/nhlPlayers'
import { deltaPct, heatSolid } from '@/lib/heat'
import type { TeamStats } from '@/pages/hockey/teamStats'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Prizm edge score 0–100 for a goalie: blended SV% delta + GSAx form. */
export function goalieEdge(g: Goalie): number {
  const deltas = NHL_WINDOW_KEYS.map((k) =>
    deltaPct(g.windows[k].svPct, g.svPct),
  )
  const blended =
    deltas[0] * 0.15 + deltas[1] * 0.2 + deltas[2] * 0.3 + deltas[3] * 0.35
  const base = (g.svPct - 0.905) * 1400 + (g.gsax ?? 0) * 24
  return Math.round(Math.min(99, Math.max(4, 50 + base + blended * 6)))
}

/** Edge score for a skater: blended SOG/G delta + per-game production. */
export function skaterEdge(s: Skater): number {
  const deltas = NHL_WINDOW_KEYS.map((k) => deltaPct(s.windows[k].sog, s.sog))
  const blended =
    deltas[0] * 0.15 + deltas[1] * 0.2 + deltas[2] * 0.3 + deltas[3] * 0.35
  const base = (s.points - 0.9) * 30 + (s.sog - 2.6) * 8
  return Math.round(Math.min(99, Math.max(4, 50 + base + blended * 1.2)))
}

export function saveAngle(label: string, detail: string, sport: 'mlb' | 'nhl' = 'nhl'): void {
  try {
    // Canonical store (DB-backed) — normalizeAngle kept the old {label, detail}
    // shape readable; new writes go through the canonical Angle directly.
    addAngle({
      title: label,
      sport,
      type: 'note',
      note: detail,
      tags: [],
      shared: false,
      snapshot: textSnapshot(detail || label, `Hockey Dashboards · ${shortDate()}`),
    })
  } catch {
    /* ignore */
  }
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic 0–1 pseudo-random stream per player. */
function stream(seed: string, n: number): number[] {
  let a = hash(seed)
  return Array.from({ length: n }, () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  })
}

export function SpectrumEdgeBar({ score }: { score: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="overline-caption text-text-3">Prizm edge</span>
        <span className="flex items-center gap-1.5">
          {score >= 75 && <Flame size={14} className="text-sp-orange" />}
          <span className="data-mono text-sm font-bold text-text-1">{score}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-bg-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full"
          style={{ background: 'var(--gradient-spectrum)' }}
        />
      </div>
    </div>
  )
}

export function DrawerActions({ angleLabel, angleDetail }: { angleLabel: string; angleDetail: string }) {
  const [added, setAdded] = useState(false)
  return (
    <div className="mt-6 flex items-center gap-2">
      <Link
        to="/profiler"
        className="flex-1 rounded-md border border-line bg-bg-2 px-4 py-2.5 text-center text-sm font-medium text-text-1 transition-colors hover:bg-bg-3"
      >
        Open in Profiler →
      </Link>
      <button
        type="button"
        onClick={() => {
          saveAngle(angleLabel, angleDetail)
          setAdded(true)
        }}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-semibold transition-all ${
          added ? 'bg-success/15 text-success' : 'bg-sp-indigo text-white hover:brightness-110'
        }`}
      >
        {added ? <Check size={15} /> : <Bookmark size={15} />}
        {added ? 'Angle added' : 'Add to angle'}
      </button>
    </div>
  )
}

const tooltipStyle = {
  backgroundColor: 'var(--bg-2)',
  border: '1px solid var(--line)',
  borderRadius: 10,
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: 12,
  color: 'var(--text-1)',
} as const

function WindowBars({
  data,
  baseline,
  format,
  domain,
}: {
  data: { w: string; v: number; d: number }[]
  baseline: number
  format: (v: number) => string
  domain: [number, number]
}) {
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
          <XAxis
            dataKey="w"
            tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: '"JetBrains Mono", monospace' }}
            axisLine={{ stroke: 'rgba(148,163,255,0.12)' }}
            tickLine={false}
          />
          <YAxis
            domain={domain}
            tickFormatter={(v: number) => format(v)}
            tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: '"JetBrains Mono", monospace' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: 'rgba(148,163,255,0.06)' }}
            formatter={(v) => [format(Number(v)), 'Window']}
          />
          <ReferenceLine
            y={baseline}
            stroke="var(--text-3)"
            strokeDasharray="4 4"
            label={{
              value: `Season ${format(baseline)}`,
              position: 'insideTopRight',
              fill: 'var(--text-3)',
              fontSize: 10,
              fontFamily: '"JetBrains Mono", monospace',
            }}
          />
          <Bar dataKey="v" radius={[3, 3, 0, 0]} isAnimationActive>
            {data.map((d) => (
              <Cell key={d.w} fill={heatSolid(d.d)} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function SplitChip({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <span
      className={`data-mono rounded-sm border border-line bg-bg-2 px-2 py-1 text-[11px] ${
        good === undefined ? 'text-text-2' : good ? 'text-[#FCA5A5]' : 'text-[#93C5FD]'
      }`}
    >
      <span className="text-text-3">{label}</span> {value}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Goalie drawer extra
// ---------------------------------------------------------------------------

export function GoalieDrawerExtra({ goalie }: { goalie: Goalie }) {
  const edge = goalieEdge(goalie)
  const chart = NHL_WINDOW_KEYS.map((k) => ({
    w: NHL_WINDOW_LABELS[k].replace(' MIN', ''),
    v: goalie.windows[k].svPct,
    d: deltaPct(goalie.windows[k].svPct, goalie.svPct),
  }))
  const fmt = (v: number) => v.toFixed(3).replace(/^0/, '')
  const [r1, r2, r3] = stream(goalie.id, 3)
  const homeSv = Math.min(0.985, goalie.svPct + (r1 - 0.5) * 0.02)
  const awaySv = Math.max(0.86, goalie.svPct - (r2 - 0.5) * 0.02)
  const top10Sv = Math.max(0.86, goalie.svPct - 0.012 + (r3 - 0.5) * 0.018)

  return (
    <div className="space-y-6">
      <SpectrumEdgeBar score={edge} />

      <div>
        <p className="overline-caption mb-2 text-text-3">SV% by window vs season</p>
        <WindowBars data={chart} baseline={goalie.svPct} format={fmt} domain={[0.85, 1]} />
      </div>

      <div>
        <p className="overline-caption mb-2 text-text-3">Splits</p>
        <div className="flex flex-wrap gap-1.5">
          <SplitChip label="Home" value={fmt(homeSv)} good={homeSv >= goalie.svPct} />
          <SplitChip label="Away" value={fmt(awaySv)} good={awaySv >= goalie.svPct} />
          <SplitChip label="vs Top 10" value={fmt(top10Sv)} good={top10Sv >= goalie.svPct} />
        </div>
      </div>

      <DrawerActions
        angleLabel={`${goalie.name} — goalie form`}
        angleDetail={`Season SV% ${fmt(goalie.svPct)} · edge ${edge}`}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skater drawer extra
// ---------------------------------------------------------------------------

/** Deterministic line / power-play deployment chips, shared by table + drawer. */
export function skaterDeployment(index: number): { line: string; pp: string } {
  return { line: index < 8 ? 'L1' : index < 16 ? 'L2' : 'L3', pp: index % 3 !== 2 ? 'PP1' : 'PP2' }
}

export function SkaterDrawerExtra({ skater, index }: { skater: Skater; index: number }) {
  const edge = skaterEdge(skater)
  const chart = NHL_WINDOW_KEYS.map((k) => ({
    w: NHL_WINDOW_LABELS[k].replace(' MIN', ''),
    v: skater.windows[k].sog,
    d: deltaPct(skater.windows[k].sog, skater.sog),
  }))
  const fmt = (v: number) => v.toFixed(1)
  const [r1, r2] = stream(skater.id, 2)
  const homeSog = Math.max(0.4, skater.sog * (1 + (r1 - 0.5) * 0.3))
  const awaySog = Math.max(0.4, skater.sog * (1 - (r2 - 0.5) * 0.3))
  const { line, pp } = skaterDeployment(index)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5">
        <span className="data-mono rounded-sm border border-line bg-bg-2 px-2 py-1 text-[11px] text-text-2">
          {skater.pos} · {line}
        </span>
        <span className="data-mono rounded-sm border border-sp-amber/30 bg-sp-amber/10 px-2 py-1 text-[11px] font-semibold text-sp-amber">
          {pp}
        </span>
        <span className="data-mono rounded-sm border border-line bg-bg-2 px-2 py-1 text-[11px] text-text-2">
          Shoots {skater.shoots}
        </span>
      </div>

      <SpectrumEdgeBar score={edge} />

      <div>
        <p className="overline-caption mb-2 text-text-3">SOG/G by window vs season</p>
        <WindowBars
          data={chart}
          baseline={skater.sog}
          format={fmt}
          domain={[0, Math.max(5, skater.sog * 1.5)]}
        />
      </div>

      <div>
        <p className="overline-caption mb-2 text-text-3">Splits — SOG/G</p>
        <div className="flex flex-wrap gap-1.5">
          <SplitChip label="Home" value={homeSog.toFixed(1)} good={homeSog >= skater.sog} />
          <SplitChip label="Away" value={awaySog.toFixed(1)} good={awaySog >= skater.sog} />
        </div>
      </div>

      <DrawerActions
        angleLabel={`${skater.name} — ${skater.pos} shot volume`}
        angleDetail={`Season ${skater.sog.toFixed(1)} SOG/G · edge ${edge}`}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Team drawer extra
// ---------------------------------------------------------------------------

export function TeamDrawerExtra({ team }: { team: TeamStats }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="overline-caption mb-2 text-text-3">Last 10 results</p>
        <div className="flex items-center gap-1.5">
          {team.last10.map((win, i) => (
            <motion.span
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25, delay: i * 0.02, ease: [0.34, 1.56, 0.64, 1] }}
              title={win ? 'Win' : 'Loss'}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                win ? 'bg-sp-cyan/15 text-sp-cyan' : 'bg-bg-3 text-text-3'
              }`}
            >
              {win ? 'W' : 'L'}
            </motion.span>
          ))}
        </div>
      </div>

      <div>
        <p className="overline-caption mb-2 text-text-3">Home / away splits</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-line bg-bg-2 px-3 py-2.5">
            <span className="overline-caption block text-text-3">Home</span>
            <span className="data-mono text-sm text-text-1">
              {team.home.gf.toFixed(2)} GF · {team.home.ga.toFixed(2)} GA
            </span>
          </div>
          <div className="rounded-md border border-line bg-bg-2 px-3 py-2.5">
            <span className="overline-caption block text-text-3">Away</span>
            <span className="data-mono text-sm text-text-1">
              {team.away.gf.toFixed(2)} GF · {team.away.ga.toFixed(2)} GA
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border border-line bg-bg-2 px-3 py-2.5">
        <span className="overline-caption text-text-3">Pace lean</span>
        <span
          className={`data-mono rounded-sm px-2 py-1 text-[11px] font-bold ${
            team.pace === 'Over' ? 'bg-pos/15 text-[#FCA5A5]' : 'bg-neg/15 text-[#93C5FD]'
          }`}
        >
          {team.pace.toUpperCase()} · {team.season.gf + team.season.ga >= 6.1 ? 'high-event' : 'low-event'}
        </span>
      </div>

      <DrawerActions
        angleLabel={`${team.abbr} — team environment`}
        angleDetail={`GF/G ${team.season.gf.toFixed(2)} · GA/G ${team.season.ga.toFixed(2)} · pace ${team.pace}`}
      />
    </div>
  )
}
