// My Angles (/angles) — the user's research worksheet: filterable grid of
// saved angle cards persisted to localStorage.prizm_angles, with inline editing,
// sharing, a shared read-only view, and a New Angle modal.

import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, ChevronDown, Gem, Plus } from 'lucide-react'
import AngleCard from '@/pages/angles/AngleCard'
import NewAngleModal from '@/pages/angles/NewAngleModal'
import SharedAngleModal from '@/pages/angles/SharedAngleModal'
import Toast from '@/pages/angles/toast'
import { useToast } from '@/pages/angles/useToast'
import {
  ANGLE_TYPE_LABELS,
  addAngle,
  exampleAngle,
  getAngle,
  getAngles,
  onAnglesChange,
  type Angle,
  type AngleType,
  type Sport,
} from '@/pages/angles/store'

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

type SportFilter = 'all' | Sport
type TypeFilter = 'all' | AngleType
type SortKey = 'recent' | 'sport' | 'shared'

const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Recent',
  sport: 'By sport',
  shared: 'Shared',
}

/**
 * Per-card error boundary — one malformed angle must never unmount the page.
 * (The store normalizes on read, this is defense-in-depth.)
 */
class CardGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err: unknown) {
    console.warn('[angles] angle card failed to render', err)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

function ChipRow<T extends string>({
  options,
  value,
  onChange,
  layoutId,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  layoutId: string
}) {
  return (
    <div className="flex items-center gap-1 rounded-sm bg-bg-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`relative rounded-[4px] px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
            value === o.value ? 'text-sp-indigo' : 'text-text-3 hover:text-text-1'
          }`}
        >
          {value === o.value && (
            <motion.span
              layoutId={layoutId}
              transition={{ duration: 0.25, ease: EASE }}
              className="absolute inset-0 rounded-[4px] bg-bg-3"
            />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export default function Angles() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [angles, setAngles] = useState<Angle[]>(() => getAngles())
  const [sport, setSport] = useState<SportFilter>('all')
  const [type, setType] = useState<TypeFilter>('all')
  const [tag, setTag] = useState<string | null>(null)
  const [showAllTags, setShowAllTags] = useState(false)
  const [sort, setSort] = useState<SortKey>('recent')
  const [sortOpen, setSortOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [sharedAngle, setSharedAngle] = useState<Angle | null>(() => {
    // Deep-linked shared view: /angles?shared=<id>
    const id = new URLSearchParams(window.location.search).get('shared')
    return id ? getAngle(id) ?? null : null
  })
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)
  const toast = useToast()

  const refresh = useCallback(() => setAngles(getAngles()), [])

  // Cross-page adds (e.g. Profiler "Add to angle") animate into the grid
  useEffect(
    () =>
      onAnglesChange(() => {
        const before = new Set(angles.map((a) => a.id))
        const next = getAngles()
        const added = next.find((a) => !before.has(a.id))
        if (added) setLastAddedId(added.id)
        setAngles(next)
      }),
    [angles],
  )

  useEffect(() => {
    if (!lastAddedId) return
    const t = setTimeout(() => setLastAddedId(null), 1600)
    return () => clearTimeout(t)
  }, [lastAddedId])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const a of angles) {
      if (!Array.isArray(a.tags)) continue
      for (const t of a.tags) set.add(t)
    }
    return [...set]
  }, [angles])
  const visibleTags = showAllTags ? allTags : allTags.slice(0, 6)
  const hiddenTagCount = allTags.length - visibleTags.length

  const filtered = useMemo(() => {
    let list = angles.filter(
      (a) =>
        (sport === 'all' || a.sport === sport) &&
        (type === 'all' || a.type === type) &&
        (!tag || a.tags.includes(tag)),
    )
    list = [...list].sort((a, b) => {
      if (sort === 'recent') return b.createdAt - a.createdAt
      if (sort === 'sport') return a.sport.localeCompare(b.sport) || b.createdAt - a.createdAt
      return Number(b.shared) - Number(a.shared) || b.createdAt - a.createdAt
    })
    return list
  }, [angles, sport, type, tag, sort])

  const sharedCount = angles.filter((a) => a.shared).length

  const seedExample = () => {
    const angle = addAngle(exampleAngle())
    setLastAddedId(angle.id)
    refresh()
    toast.show('Example angle filed')
  }

  return (
    <div className="space-y-6">
      {/* S1 — page row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="flex flex-wrap items-center gap-3"
      >
        <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-text-1">
          Your research, <span className="text-spectrum">filed.</span>
        </h2>
        <span className="data-mono rounded-sm border border-line bg-bg-2 px-2 py-1 text-[11px] text-text-2">
          {angles.length} angle{angles.length === 1 ? '' : 's'} · {sharedCount} shared
        </span>
        <div className="ml-auto flex items-center gap-2">
          {/* Sort dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-md border border-line bg-bg-2 px-3 py-2.5 text-sm font-medium text-text-1 transition-colors hover:bg-bg-3"
            >
              {SORT_LABELS[sort]} <ChevronDown size={14} className={`transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {sortOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="absolute right-0 top-full z-30 mt-1.5 w-36 overflow-hidden rounded-md border border-line bg-bg-2 py-1 shadow-raised"
                >
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setSort(k)
                        setSortOpen(false)
                      }}
                      className={`block w-full px-3 py-2 text-left text-[13px] transition-colors ${
                        sort === k ? 'bg-bg-3 text-sp-indigo' : 'text-text-2 hover:bg-bg-3 hover:text-text-1'
                      }`}
                    >
                      {SORT_LABELS[k]}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-sp-indigo px-5 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97]"
          >
            <Plus size={15} /> New angle
          </button>
        </div>
      </motion.div>

      {angles.length > 0 && (
        <>
          {/* S2 — filter chips */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05, ease: EASE }}
            className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1"
          >
            <ChipRow
              layoutId="angles-sport-pill"
              options={[
                { value: 'all', label: 'All' },
                { value: 'mlb', label: 'MLB' },
                { value: 'nhl', label: 'NHL' },
              ]}
              value={sport}
              onChange={setSport}
            />
            <ChipRow
              layoutId="angles-type-pill"
              options={[
                { value: 'all', label: 'All types' },
                { value: 'table', label: ANGLE_TYPE_LABELS.table + 's' },
                { value: 'ai', label: ANGLE_TYPE_LABELS.ai + 's' },
                { value: 'edge', label: ANGLE_TYPE_LABELS.edge + 's' },
                { value: 'note', label: ANGLE_TYPE_LABELS.note + 's' },
              ]}
              value={type}
              onChange={setType}
            />
            {visibleTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(tag === t ? null : t)}
                className={`data-mono rounded-sm border px-2 py-1.5 text-[11px] transition-colors ${
                  tag === t
                    ? 'border-sp-indigo/60 bg-sp-indigo/15 text-sp-indigo'
                    : 'border-line bg-bg-2 text-text-3 hover:text-text-1'
                }`}
              >
                #{t}
              </button>
            ))}
            {hiddenTagCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAllTags(true)}
                className="rounded-sm px-1.5 py-1.5 text-[11px] font-medium text-text-3 transition-colors hover:text-text-1"
              >
                +{hiddenTagCount} more
              </button>
            )}
          </motion.div>

          {/* S3 — card grid */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-bg-1 px-6 py-14 text-center">
              <Gem size={28} strokeWidth={1.5} className="text-text-3" />
              <p className="text-sm text-text-2">No angles match these filters.</p>
              <button
                type="button"
                onClick={() => {
                  setSport('all')
                  setType('all')
                  setTag(null)
                }}
                className="rounded-md border border-line bg-bg-2 px-4 py-2 text-sm font-medium text-text-1 transition-colors hover:bg-bg-3"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {filtered.map((a, i) => (
                  <motion.div
                    key={a.id}
                    layout="position"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.06, ease: EASE }}
                  >
                    <CardGuard>
                      <AngleCard
                        angle={a}
                        isNew={a.id === lastAddedId}
                        onToast={toast.show}
                        onChanged={refresh}
                        onPreviewShared={setSharedAngle}
                      />
                    </CardGuard>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* S4 — empty state */}
      {angles.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mx-auto flex max-w-[440px] flex-col items-center py-16 text-center md:py-24"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
            className="relative flex h-20 w-20 items-center justify-center rounded-xl border border-line bg-bg-1"
          >
            <img src="/favicon.svg" alt="" className="h-10 w-10" />
            <span className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-sp-indigo text-white">
              <Bookmark size={13} strokeWidth={1.5} />
            </span>
          </motion.div>
          <h3 className="mt-6 font-display text-2xl font-semibold text-text-1">No angles yet.</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-2">
            Every table in Prizm has a bookmark. Save what you see, and your research builds itself.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/dashboard"
              className="rounded-md bg-sp-indigo px-5 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97]"
            >
              Browse MLB dashboards
            </Link>
            <button
              type="button"
              onClick={seedExample}
              className="rounded-md border border-line bg-bg-2 px-5 py-2.5 text-sm font-semibold text-text-1 transition-colors hover:bg-bg-3"
            >
              See an example angle
            </button>
          </div>
        </motion.div>
      )}

      {/* Modals + toast */}
      <AnimatePresence>
        {newOpen && (
          <NewAngleModal
            onClose={() => setNewOpen(false)}
            onCreated={(angle) => {
              setNewOpen(false)
              setLastAddedId(angle.id)
              refresh()
              toast.show('Angle filed')
            }}
          />
        )}
        {sharedAngle && (
          <SharedAngleModal
            angle={sharedAngle}
            onClose={() => {
              setSharedAngle(null)
              if (searchParams.get('shared')) setSearchParams({}, { replace: true })
            }}
          />
        )}
      </AnimatePresence>
      <Toast message={toast.message} />
    </div>
  )
}
