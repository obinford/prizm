import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, Check, ChevronDown, Pin, X } from 'lucide-react'
import type { FilterRule } from '@/lib/filterRules'

/**
 * Filters & Saved Views (design.md §7.8).
 * Dropdown chips with pin-to-top and views persisted to localStorage.prizm_views.
 */

export interface FilterOption {
  value: string
  label: string
}

export interface FilterDef {
  key: string
  label: string
  options: FilterOption[]
}

export type FilterValues = Record<string, string | undefined>

export interface SavedView {
  id: string
  name: string
  scope: string
  values: FilterValues
  /** Numeric predicates. Optional so views saved before Step 4 still load. */
  rules?: FilterRule[]
  isDefault?: boolean
  createdAt: number
}

const VIEWS_KEY = 'prizm_views'
const PINNED_KEY = 'prizm_pinned'

export function getSavedViews(scope?: string): SavedView[] {
  try {
    const raw = localStorage.getItem(VIEWS_KEY)
    const views = raw ? (JSON.parse(raw) as SavedView[]) : []
    return scope ? views.filter((v) => v.scope === scope) : views
  } catch {
    return []
  }
}

function persistViews(views: SavedView[]) {
  localStorage.setItem(VIEWS_KEY, JSON.stringify(views))
}

export function saveView(view: Omit<SavedView, 'id' | 'createdAt'>): SavedView {
  const all = getSavedViews()
  if (view.isDefault) {
    // one default per scope
    for (const v of all) {
      if (v.scope === view.scope) v.isDefault = false
    }
  }
  const saved: SavedView = { ...view, id: `view-${Date.now()}`, createdAt: Date.now() }
  persistViews([...all, saved])
  return saved
}

export function deleteView(id: string) {
  persistViews(getSavedViews().filter((v) => v.id !== id))
}

function getPinned(scope: string): string[] {
  try {
    const raw = localStorage.getItem(PINNED_KEY)
    const all = raw ? (JSON.parse(raw) as Record<string, string[]>) : {}
    return all[scope] ?? []
  } catch {
    return []
  }
}

function setPinned(scope: string, keys: string[]) {
  try {
    const raw = localStorage.getItem(PINNED_KEY)
    const all = raw ? (JSON.parse(raw) as Record<string, string[]>) : {}
    all[scope] = keys
    localStorage.setItem(PINNED_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

export interface FilterBarProps {
  filters: FilterDef[]
  values: FilterValues
  onChange: (values: FilterValues) => void
  /** namespace for saved views + pinned filters, e.g. 'dashboard-mlb:starters' */
  scope: string
  showSaveView?: boolean
  /** Current tab's rules, read at save time. Optional — Gamecenter has none. */
  getRules?: () => FilterRule[]
  /** Restore a saved view's rules into the active tab. Missing rules mean []. */
  applyRules?: (rules: FilterRule[]) => void
}

function Chip({
  def,
  value,
  pinned,
  onSelect,
  onTogglePin,
  staggerIndex,
}: {
  def: FilterDef
  value: string | undefined
  pinned: boolean
  onSelect: (v: string | undefined) => void
  onTogglePin: () => void
  staggerIndex: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const activeLabel = value ? def.options.find((o) => o.value === value)?.label : undefined

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: staggerIndex * 0.05 }}
      className="group relative"
    >
      <div
        className={`flex items-center gap-1 rounded-sm border text-sm transition-colors ${
          activeLabel
            ? 'border-line-strong bg-bg-2 text-text-1'
            : 'border-line bg-bg-2 text-text-2 hover:text-text-1'
        }`}
      >
        {activeLabel && <span className="ml-2.5 h-1.5 w-1.5 rounded-full bg-sp-indigo" />}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-2"
          aria-expanded={open}
        >
          <span className="text-[13px] font-medium">
            {def.label}
            {activeLabel && <span className="text-text-3"> · </span>}
            {activeLabel && <span className="text-text-1">{activeLabel}</span>}
          </span>
          <ChevronDown size={13} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
        <button
          type="button"
          onClick={onTogglePin}
          aria-label={pinned ? `Unpin ${def.label}` : `Pin ${def.label}`}
          className={`mr-1.5 rounded-sm p-1 transition-all ${
            pinned
              ? 'text-sp-indigo opacity-100'
              : 'text-text-3 opacity-0 hover:text-text-1 group-hover:opacity-100'
          }`}
        >
          <Pin size={13} />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-30 mt-1.5 min-w-[160px] rounded-md border border-line bg-bg-2 p-1 shadow-raised"
          >
            <button
              type="button"
              onClick={() => {
                onSelect(undefined)
                setOpen(false)
              }}
              className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-[13px] text-text-3 transition-colors hover:bg-bg-3 hover:text-text-1"
            >
              Any
              {!value && <Check size={13} className="text-sp-indigo" />}
            </button>
            {def.options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onSelect(o.value)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-[13px] text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
              >
                {o.label}
                {value === o.value && <Check size={13} className="text-sp-indigo" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function FilterBar({ filters, values, onChange, scope, showSaveView = true, getRules, applyRules }: FilterBarProps) {
  const [views, setViews] = useState<SavedView[]>(() => getSavedViews(scope))
  const [pinned, setPinnedState] = useState<string[]>(() => getPinned(scope))
  // Legacy views saved under the bare 'dashboard-mlb' scope before per-tab
  // scopes existed. They deliberately stop appearing (rule 6), so surface
  // them and offer to re-scope to the current tab.
  const [legacy, setLegacy] = useState<SavedView[]>(() => getSavedViews('dashboard-mlb'))
  const [viewsOpen, setViewsOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [viewName, setViewName] = useState('')
  const [makeDefault, setMakeDefault] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const viewsRef = useRef<HTMLDivElement>(null)

  // The scope is per-tab, so tab switches must reload views and pins.
  useEffect(() => {
    setViews(getSavedViews(scope))
    setPinnedState(getPinned(scope))
    setLegacy(getSavedViews('dashboard-mlb'))
  }, [scope])

  useEffect(() => {
    if (!viewsOpen) return
    const onDoc = (e: MouseEvent) => {
      if (viewsRef.current && !viewsRef.current.contains(e.target as Node)) setViewsOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [viewsOpen])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const setValue = (key: string, v: string | undefined) => onChange({ ...values, [key]: v })

  const togglePin = (key: string) => {
    const next = pinned.includes(key) ? pinned.filter((k) => k !== key) : [...pinned, key]
    setPinnedState(next)
    setPinned(scope, next)
    setToast(pinned.includes(key) ? 'Filter unpinned' : 'Filter pinned')
  }

  const pinnedDefs = filters.filter((f) => pinned.includes(f.key))
  const unpinnedDefs = filters.filter((f) => !pinned.includes(f.key))

  const handleSave = () => {
    if (!viewName.trim()) return
    saveView({ name: viewName.trim(), scope, values, rules: getRules?.() ?? [], isDefault: makeDefault })
    setViews(getSavedViews(scope))
    setSaveOpen(false)
    setViewName('')
    setMakeDefault(false)
    setToast('View saved')
  }

  const applyView = (view: SavedView) => {
    onChange({ ...view.values })
    // Guard the read: pre-Step-4 JSON has no rules field.
    applyRules?.(view.rules ?? [])
    setViewsOpen(false)
  }

  /** Re-scope a legacy dashboard-mlb view to the current tab, then drop the old row. */
  const migrateLegacy = () => {
    for (const v of legacy) {
      saveView({ name: v.name, scope, values: v.values, rules: v.rules ?? [], isDefault: v.isDefault })
      deleteView(v.id)
    }
    setViews(getSavedViews(scope))
    setLegacy(getSavedViews('dashboard-mlb'))
    setToast(`${legacy.length} view${legacy.length === 1 ? '' : 's'} moved to this tab`)
  }

  return (
    <div className="space-y-2">
      {/* Pinned row */}
      {pinnedDefs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="overline-caption mr-1 flex items-center gap-1 text-text-3">
            <Pin size={11} /> Pinned
          </span>
          {pinnedDefs.map((f, i) => (
            <Chip
              key={f.key}
              def={f}
              value={values[f.key]}
              pinned
              onSelect={(v) => setValue(f.key, v)}
              onTogglePin={() => togglePin(f.key)}
              staggerIndex={i}
            />
          ))}
        </div>
      )}

      {/* Legacy-scope notice — pre-per-tab saved views, with a re-scope offer */}
      {legacy.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-sm border border-dashed border-line bg-bg-2/50 px-3 py-2">
          <p className="text-[11px] text-text-3">
            {legacy.length} saved view{legacy.length === 1 ? '' : 's'} from before per-tab scopes
            {legacy.length === 1 ? ' is' : ' are'} not shown here.
          </p>
          <button
            type="button"
            onClick={migrateLegacy}
            className="data-mono rounded-sm border border-line bg-bg-2 px-2 py-0.5 text-[11px] font-medium text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
          >
            Move to this tab
          </button>
        </div>
      )}

      {/* Main filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {unpinnedDefs.map((f, i) => (
          <Chip
            key={f.key}
            def={f}
            value={values[f.key]}
            pinned={false}
            onSelect={(v) => setValue(f.key, v)}
            onTogglePin={() => togglePin(f.key)}
            staggerIndex={i}
          />
        ))}

        <div className="ml-auto flex items-center gap-2">
          {/* Views dropdown */}
          <div ref={viewsRef} className="relative">
            <button
              type="button"
              onClick={() => setViewsOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-sm border border-line bg-bg-2 px-3 py-2 text-[13px] font-medium text-text-2 transition-colors hover:text-text-1"
              aria-expanded={viewsOpen}
            >
              <Bookmark size={13} className="text-sp-magenta" />
              Views
              <ChevronDown size={13} className={`transition-transform duration-200 ${viewsOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {viewsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full z-30 mt-1.5 w-56 rounded-md border border-line bg-bg-2 p-1 shadow-raised"
                >
                  {views.length === 0 && (
                    <p className="px-3 py-3 text-[13px] text-text-3">No saved views yet.</p>
                  )}
                  {views.map((v) => (
                    <div key={v.id} className="group flex items-center">
                      <button
                        type="button"
                        onClick={() => applyView(v)}
                        className="flex flex-1 items-center gap-2 rounded-sm px-3 py-2 text-left text-[13px] text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
                      >
                        <Bookmark size={12} className="text-sp-magenta" />
                        <span className="flex-1 truncate">{v.name}</span>
                        {v.isDefault && (
                          <span className="rounded-sm bg-sp-indigo/20 px-1 py-0.5 text-[10px] text-sp-indigo">
                            default
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete view ${v.name}`}
                        className="mr-1 rounded-sm p-1 text-text-3 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                        onClick={() => {
                          deleteView(v.id)
                          setViews(getSavedViews(scope))
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {showSaveView && (
            <button
              type="button"
              onClick={() => setSaveOpen(true)}
              className="rounded-sm border border-line bg-bg-2 px-3 py-2 text-[13px] font-medium text-text-1 transition-colors hover:bg-bg-3"
            >
              Save view
            </button>
          )}
        </div>
      </div>

      {/* Save view modal */}
      <AnimatePresence>
        {saveOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-[rgba(4,5,12,0.7)] backdrop-blur-[8px]"
              onClick={() => setSaveOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.22 }}
              className="fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-bg-1 p-6 shadow-raised"
              role="dialog"
              aria-label="Save view"
            >
              <h3 className="font-display text-lg font-semibold text-text-1">Save this view</h3>
              <label className="overline-caption mb-2 mt-5 block text-text-3" htmlFor="view-name">
                Name
              </label>
              <input
                id="view-name"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="e.g. Aces vs righty lineups"
                className="h-11 w-full rounded-sm border border-line bg-bg-2 px-3 text-base text-text-1 placeholder:text-text-3 focus:border-sp-indigo focus:outline-none focus:ring-[3px] focus:ring-[rgba(99,102,241,0.25)] md:text-[15px]"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm text-text-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={makeDefault}
                  onClick={() => setMakeDefault((v) => !v)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${makeDefault ? 'bg-sp-indigo' : 'bg-bg-3'}`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-200 ${
                      makeDefault ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                Make default for this page
              </label>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSaveOpen(false)}
                  className="rounded-md px-4 py-2.5 text-sm text-text-2 transition-colors hover:text-text-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!viewName.trim()}
                  className="rounded-md bg-sp-indigo px-5 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40"
                >
                  Save view
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 overflow-hidden rounded-md border border-line bg-bg-2 py-3 pl-4 pr-5 shadow-raised"
          >
            <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: 'var(--gradient-spectrum)' }} />
            <span className="text-sm text-text-1">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
