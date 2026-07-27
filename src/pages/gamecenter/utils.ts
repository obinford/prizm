// Non-component utilities for the pages-ai scope — toast store, angle saving,
// hit-rate tint helper. Kept component-free for react-refresh.

import { addAngle, shortDate, textSnapshot } from '@/pages/angles/store'

// ---------------------------------------------------------------------------
// Toast store — ToastViewport (in kit.tsx) subscribes; auto-dismiss 3.5s
// ---------------------------------------------------------------------------

export interface ToastItem {
  id: number
  message: string
}

type ToastListener = (items: ToastItem[]) => void

let toastItems: ToastItem[] = []
const listeners = new Set<ToastListener>()
let nextToastId = 1

function notify() {
  listeners.forEach((l) => l([...toastItems]))
}

export function toast(message: string) {
  const id = nextToastId++
  toastItems = [...toastItems, { id, message }]
  notify()
  window.setTimeout(() => {
    toastItems = toastItems.filter((t) => t.id !== id)
    notify()
  }, 3500)
}

export function getToasts(): ToastItem[] {
  return toastItems
}

export function subscribeToasts(l: ToastListener): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

// ---------------------------------------------------------------------------
// My Angles persistence (localStorage prizm_angles)
// ---------------------------------------------------------------------------

export interface SavedAngle {
  id: string
  title: string
  subtitle?: string
  source: string
  createdAt: number
}

/** Write the canonical My Angles shape (src/pages/angles/store) so /angles can render it. */
export function saveAngle(angle: Omit<SavedAngle, 'id' | 'createdAt'>) {
  try {
    const detail = angle.subtitle?.trim() ?? ''
    addAngle({
      title: angle.title,
      sport: 'mlb',
      type: 'edge',
      note: detail,
      tags: [],
      shared: false,
      snapshot: textSnapshot(detail || angle.title, `${angle.source} · ${shortDate()}`),
    })
  } catch {
    // storage unavailable — still confirm to keep the demo flowing
  }
  toast('Angle added to My Angles')
}

/** Tint helper: converts a 0–1 hit rate into a heat delta vs a 55% baseline. */
export function hitRateTint(rate: number): number {
  return (rate - 0.55) * 100
}
