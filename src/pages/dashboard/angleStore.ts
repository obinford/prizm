// "My Angles" storage (prizm_angles) + toast state hook for the dashboard.
//
// The dashboard "Save to angle" popover previously wrote its own shape
// ({id, name, items[]}) which white-screened /angles. Persistence is now
// delegated to the canonical store in src/pages/angles/store — every angle
// written here has the canonical {id, title, note, tags[], snapshot, createdAt}
// shape; the dashboard's per-angle `items` list rides along as extra metadata.

import { useEffect, useState } from 'react'
import {
  addAngle,
  getAngles as readAngles,
  shortDate,
  textSnapshot,
  updateAngle,
  type Angle as CanonicalAngle,
} from '@/pages/angles/store'

export interface AngleItem {
  id: string
  kind: 'mlb-pitcher' | 'mlb-batter' | 'mlb-bullpen'
  label: string
  meta?: string
  addedAt: number
}

/** Canonical angle plus the dashboard's optional collected-items metadata. */
export interface Angle extends CanonicalAngle {
  items?: AngleItem[]
}

export function getAngles(): Angle[] {
  // readAngles normalizes any legacy/alien shape, so the popover can list
  // every saved angle regardless of which page wrote it.
  return readAngles() as Angle[]
}

/** Add an item to an existing angle (by id) or create a new named angle. */
export function addToAngle(angleId: string | null, newName: string | undefined, item: Omit<AngleItem, 'addedAt'>): void {
  const entry: AngleItem = { ...item, addedAt: Date.now() }
  if (angleId) {
    const target = getAngles().find((a) => a.id === angleId)
    if (target) {
      const items = Array.isArray(target.items) ? target.items : []
      const patch = { items: [...items, entry] }
      updateAngle(angleId, patch)
      return
    }
  }
  const name = (newName ?? '').trim() || 'Untitled angle'
  const line = item.meta ? `${item.label} — ${item.meta}` : item.label
  const angle = {
    title: name,
    sport: 'mlb' as const,
    type: 'note' as const,
    note: `• ${line}`,
    tags: [] as string[],
    shared: false,
    snapshot: textSnapshot(line, `MLB Dashboards · ${shortDate()}`),
    items: [entry],
  }
  addAngle(angle)
}

/** Toast message with 3.5s auto-dismiss. */
export function useToast(): [string | null, (msg: string) => void] {
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])
  return [toast, setToast]
}
