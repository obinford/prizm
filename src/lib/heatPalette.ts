// Colourblind-safe heat palette — first-class, persisted, app-wide.
//
// The heat ramp is the ONLY colour-carrying-meaning surface in Prizm (every
// other colour is decoration, branding, or a status badge with a text label),
// so one module-level switch covers the whole app. Positive deltas flip from
// red to orange; negative stays blue. Blue–orange is the standard
// colourblind-safe diverging pair — it survives the common red-vision
// deficiencies that degrade red's lightness and saturation contrast.
//
// Persisted in localStorage; subscribers re-render via useSyncExternalStore,
// the same pattern as src/lib/slateDay.ts. Heat helpers read getHeatPalette()
// at call time, so one subscriber high in the tree (Dashboard) repaints every
// table on toggle.

import { useSyncExternalStore } from 'react'

export type HeatPalette = 'default' | 'colourblind'

const STORAGE_KEY = 'prizm-heat-palette'

function load(): HeatPalette {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'colourblind'
      ? 'colourblind'
      : 'default'
  } catch {
    return 'default'
  }
}

let current: HeatPalette = load()
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function getHeatPalette(): HeatPalette {
  return current
}

export function setHeatPalette(p: HeatPalette) {
  if (p === current) return
  current = p
  try {
    localStorage.setItem(STORAGE_KEY, p)
  } catch {
    // private mode — session-only, still works
  }
  emit()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** React binding. */
export function useHeatPalette(): HeatPalette {
  return useSyncExternalStore(subscribe, getHeatPalette, getHeatPalette)
}

/**
 * Positive-delta colours per palette: cell rgb triplet, hot-text hex, solid
 * accent. Negative is always blue (#3B82F6 family) in both palettes.
 */
export const POS_COLORS: Record<
  HeatPalette,
  { cell: [number, number, number]; text: string; solid: string }
> = {
  default: { cell: [239, 68, 68], text: '#FCA5A5', solid: '#EF4444' },
  colourblind: { cell: [249, 115, 22], text: '#FDBA74', solid: '#F97316' },
}
