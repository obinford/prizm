// Shared UI components for the pages-ai scope (GameCenter / EdgeCenter / Ask).
// Toast viewport (design.md §7.10), delta chips, sport chips, edge-score gauge,
// confidence meter. Non-component helpers live in ./utils.

import { useEffect, useId, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import { deltaTextClass, heatBg } from '@/lib/heat'
import { getToasts, subscribeToasts, type ToastItem } from './utils'

// ---------------------------------------------------------------------------
// Toast viewport — bottom-right, bg-2 card, 3px spectrum left bar
// ---------------------------------------------------------------------------

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>(getToasts())
  useEffect(() => subscribeToasts(setItems), [])
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[70] flex w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden rounded-md border border-line bg-bg-2 py-3 pl-4 pr-3 shadow-raised"
            role="status"
          >
            <span
              className="absolute inset-y-0 left-0 w-[3px]"
              style={{ background: 'var(--gradient-spectrum)' }}
            />
            <span className="text-sm font-medium text-text-1">{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delta chip — heat-tinted, mono, signed
// ---------------------------------------------------------------------------

export function DeltaChip({
  dPct,
  label,
  icon,
  className = '',
}: {
  dPct: number
  label: string
  icon?: 'zap'
  className?: string
}) {
  return (
    <span
      className={`data-mono inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[12px] font-medium ${deltaTextClass(dPct)} ${className}`}
      style={{ backgroundColor: heatBg(dPct) }}
    >
      {icon === 'zap' && <Zap size={12} strokeWidth={2} />}
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Sport chip — MLB amber-tinted / NHL cyan-tinted
// ---------------------------------------------------------------------------

export function SportChip({ sport }: { sport: 'mlb' | 'nhl' }) {
  return sport === 'mlb' ? (
    <span className="data-mono rounded-sm bg-sp-amber/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-sp-amber">
      MLB
    </span>
  ) : (
    <span className="data-mono rounded-sm bg-sp-cyan/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-sp-cyan">
      NHL
    </span>
  )
}

// ---------------------------------------------------------------------------
// Edge Score gauge — circular ring, spectrum gradient stroke
// ---------------------------------------------------------------------------

const SPECTRUM_STOPS: [string, string][] = [
  ['0%', '#6366F1'],
  ['22%', '#22D3EE'],
  ['40%', '#2DD4BF'],
  ['58%', '#A3E635'],
  ['76%', '#FBBF24'],
  ['100%', '#F472B6'],
]

export function EdgeGauge({ score, size = 56 }: { score: number; size?: number }) {
  const gradId = useId()
  const stroke = 5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score)) / 100
  const rareAir = score >= 80
  return (
    <div
      className={`relative shrink-0 rounded-full ${rareAir ? 'animate-ring-pulse' : ''}`}
      style={{ width: size, height: size }}
      title={`Edge Score ${score}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            {SPECTRUM_STOPS.map(([off, col]) => (
              <stop key={off} offset={off} stopColor={col} />
            ))}
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--bg-3)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * (1 - pct) }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className="data-mono absolute inset-0 flex items-center justify-center text-[15px] font-bold text-text-1">
        {score}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Confidence meter — 3-segment indigo bar
// ---------------------------------------------------------------------------

export function ConfidenceMeter({ level, delay = 0 }: { level: 1 | 2 | 3; delay?: number }) {
  return (
    <div className="flex items-center gap-1" title={`Confidence ${level}/3`}>
      {[1, 2, 3].map((seg) => (
        <motion.span
          key={seg}
          initial={{ scaleX: 0, opacity: 0.2 }}
          whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.4, delay: delay + seg * 0.08, ease: [0.16, 1, 0.3, 1] }}
          className={`h-1.5 w-8 origin-left rounded-full ${seg <= level ? 'bg-sp-indigo' : 'bg-bg-3'}`}
        />
      ))}
      <span className="data-mono ml-2 text-[11px] text-text-3">{level}/3</span>
    </div>
  )
}
