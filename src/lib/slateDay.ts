// Slate-day store — Today / Tomorrow, shared between the topbar stepper and
// every dashboard tab.
//
// The topbar stepper previously rendered `‹ Today ›` with no click handlers at
// all (AppShell.tsx). It is now a real control: one source of truth, subscribed
// to by the surfaces that care.
//
// Deliberately a tiny module store rather than context — it mirrors the pattern
// already used by src/lib/follows.ts and src/pages/angles/store.ts, and avoids
// re-rendering the whole shell on every change.

import { useSyncExternalStore } from 'react'

export type SlateDay = 'today' | 'tomorrow'

export const SLATE_DAYS: SlateDay[] = ['today', 'tomorrow']

export const SLATE_DAY_LABEL: Record<SlateDay, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
}

let current: SlateDay = 'today'
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function getSlateDay(): SlateDay {
  return current
}

export function setSlateDay(day: SlateDay) {
  if (day === current) return
  current = day
  emit()
}

/** Step forward or back through the available days. Clamps at both ends. */
export function stepSlateDay(direction: -1 | 1) {
  const i = SLATE_DAYS.indexOf(current)
  const next = SLATE_DAYS[i + direction]
  if (next) setSlateDay(next)
}

export function canStepSlateDay(direction: -1 | 1): boolean {
  const i = SLATE_DAYS.indexOf(current)
  return SLATE_DAYS[i + direction] != null
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** React binding. */
export function useSlateDay(): SlateDay {
  return useSyncExternalStore(subscribe, getSlateDay, getSlateDay)
}

/**
 * The calendar date the current slate day refers to.
 * Tomorrow's slate is today + 1 in the user's local timezone.
 */
export function slateDate(day: SlateDay = current): Date {
  const d = new Date()
  if (day === 'tomorrow') d.setDate(d.getDate() + 1)
  return d
}
