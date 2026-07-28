// Prizm heat-ramp utility (design.md §2.4).
// Red = positive delta vs season baseline (good for the angle).
// Blue = negative delta (fade). Steps: ±2%, ±5%, ±10%, ±18%, beyond.
// The colourblind palette (src/lib/heatPalette.ts) swaps positive red for
// orange; both hex literals below stay in source so Tailwind emits both.

import { POS_COLORS, getHeatPalette } from '@/lib/heatPalette'

export type HeatSide = 'pos' | 'neg' | 'neutral'
export type HeatStep = 0 | 1 | 2 | 3 | 4 | 5

const POS_ALPHA = [0.1, 0.18, 0.3, 0.46, 0.64]
const NEG_ALPHA = [0.1, 0.18, 0.3, 0.46, 0.64]

/** Hot-text class for the ACTIVE palette — both literals must stay visible
 *  to the Tailwind scanner. */
function posTextClass(): string {
  return getHeatPalette() === 'colourblind' ? 'text-[#FDBA74]' : 'text-[#FCA5A5]'
}

/**
 * Given a signed % delta vs season baseline, return ramp step 0–5.
 * |d| < 2 → 0 (neutral), < 5 → 1, < 10 → 2, < 18 → 3, < 25 → 4, else 5.
 */
export function heatStep(deltaPct: number): HeatStep {
  const a = Math.abs(deltaPct)
  if (a < 2) return 0
  if (a < 5) return 1
  if (a < 10) return 2
  if (a < 18) return 3
  if (a < 25) return 4
  return 5
}

export function heatSide(deltaPct: number): HeatSide {
  const s = heatStep(deltaPct)
  if (s === 0) return 'neutral'
  return deltaPct > 0 ? 'pos' : 'neg'
}

/** Percent delta of a window value vs a season baseline. Guards divide-by-zero. */
export function deltaPct(windowValue: number, baseline: number): number {
  if (baseline === 0) return 0
  return ((windowValue - baseline) / Math.abs(baseline)) * 100
}

/** Cell background for a delta, as an rgba() string. */
export function heatBg(dPct: number): string {
  const step = heatStep(dPct)
  if (step === 0) return 'rgba(148,163,184,0.05)'
  const alpha = (dPct > 0 ? POS_ALPHA : NEG_ALPHA)[step - 1]
  if (dPct > 0) {
    const [r, g, b] = POS_COLORS[getHeatPalette()].cell
    return `rgba(${r},${g},${b},${alpha})`
  }
  return `rgba(59,130,246,${alpha})`
}

/**
 * Tailwind-style classes for a heat cell. Uses inline CSS var backgrounds so
 * steps are exact per §2.4. Returns { background, textClass }.
 */
export function heatCell(dPct: number): { background: string; textClass: string } {
  const step = heatStep(dPct)
  const background = heatBg(dPct)
  // steps 4–5 get tinted text for extra signal
  const textClass = step >= 4 ? (dPct > 0 ? posTextClass() : 'text-[#93C5FD]') : 'text-text-1'
  return { background, textClass }
}

/** Signed delta chip text color class. */
export function deltaTextClass(dPct: number): string {
  const step = heatStep(dPct)
  if (step === 0) return 'text-text-3'
  return dPct > 0 ? posTextClass() : 'text-[#93C5FD]'
}

/** Format a signed delta: +2.4 / −1.1 (true minus sign per design). */
export function formatDelta(d: number, decimals = 1): string {
  const v = d.toFixed(decimals)
  if (d > 0) return `+${v}`
  if (d < 0) return `−${Math.abs(d).toFixed(decimals)}`
  return '±0.0'
}

/** Solid accent for dots/bars. */
export function heatSolid(dPct: number): string {
  return dPct >= 0 ? POS_COLORS[getHeatPalette()].solid : '#3B82F6'
}
