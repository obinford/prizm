// Profiler S1 — empty search state: hero search, sport toggle, trending chips,
// recently viewed avatars. Live dropdown with keyboard navigation.

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search } from 'lucide-react'
import {
  TRENDING_IDS,
  findPlayer,
  getRecentPlayers,
  initials,
  kindOf,
  posLabel,
  searchAllPlayers,
  type AnyPlayer,
} from '@/pages/profiler/derive'

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

interface Props {
  onSelect: (player: AnyPlayer) => void
}

export default function PlayerSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [sport, setSport] = useState<'mlb' | 'nhl'>('mlb')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [focused, setFocused] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => searchAllPlayers(query, sport), [query, sport])
  const trending = useMemo(
    () => TRENDING_IDS.map(findPlayer).filter((p): p is AnyPlayer => Boolean(p)),
    [],
  )
  const [recent] = useState<AnyPlayer[]>(() => getRecentPlayers())

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[activeIdx]) {
      onSelect(results[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-center pt-16 md:pt-24">
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="text-center font-display text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-text-1 md:text-[40px]"
      >
        Profile <span className="text-spectrum">any player.</span>
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08, ease: EASE }}
        className="mt-3 text-center text-sm text-text-2"
      >
        Game logs, splits, batted ball and news — every side of one player.
      </motion.p>

      {/* Search input */}
      <motion.div
        ref={wrapRef}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0, scale: focused ? 1.02 : 1 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="relative mt-8 w-full"
      >
        <div
          className="flex h-14 items-center gap-3 rounded-md border bg-bg-2 px-4 transition-colors"
          style={{
            borderColor: focused ? 'var(--sp-indigo)' : 'var(--line)',
            boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.25)' : 'none',
          }}
        >
          <Search size={18} strokeWidth={1.5} className="shrink-0 text-text-3" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIdx(0)
              setOpen(true)
            }}
            onFocus={() => {
              setFocused(true)
              setOpen(true)
            }}
            onBlur={() => setFocused(false)}
            onKeyDown={onKeyDown}
            placeholder="Type a name — e.g. 'Skenes', 'MacKinnon'…"
            className="data-mono h-full w-full bg-transparent text-base text-text-1 placeholder:text-text-3 focus:outline-none md:text-sm"
            aria-label="Search players"
          />
          {/* Sport toggle */}
          <div className="flex shrink-0 items-center rounded-sm bg-bg-3 p-0.5">
            {(['mlb', 'nhl'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSport(s)}
                className={`rounded-[4px] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                  sport === s ? 'bg-bg-2 text-sp-indigo' : 'text-text-3 hover:text-text-1'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Live dropdown */}
        <AnimatePresence>
          {open && results.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-md border border-line bg-bg-2 py-1 shadow-raised"
              role="listbox"
            >
              {results.map((p, i) => (
                <motion.li
                  key={p.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.03, ease: EASE }}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === activeIdx}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => onSelect(p)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === activeIdx ? 'bg-sp-indigo/15 text-text-1' : 'text-text-2'
                    }`}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-text-1"
                      style={{
                        background:
                          'linear-gradient(var(--bg-3), var(--bg-3)) padding-box, var(--gradient-spectrum) border-box',
                        border: '1.5px solid transparent',
                      }}
                    >
                      {initials(p.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-text-1">{p.name}</span>
                      <span className="data-mono block text-[11px] text-text-3">
                        {p.team} · {posLabel(p)} · {p.sport.toUpperCase()}
                      </span>
                    </span>
                    <span className="data-mono text-[10px] uppercase tracking-wider text-text-3">
                      {kindOf(p)}
                    </span>
                  </button>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Trending lookups */}
      <div className="mt-10 w-full">
        <p className="overline-caption text-center text-text-3">Trending lookups</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {trending.map((p, i) => (
            <motion.button
              key={p.id}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 + i * 0.05, ease: EASE }}
              onClick={() => onSelect(p)}
              className="rounded-sm border border-line bg-bg-2 px-3.5 py-2 text-sm text-text-2 transition-colors hover:border-line-strong hover:bg-bg-3 hover:text-text-1"
            >
              {p.name}
              <span className="data-mono ml-2 text-[10px] uppercase text-text-3">{p.team}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Recently viewed */}
      {recent.length > 0 && (
        <div className="mt-10 w-full">
          <p className="overline-caption text-center text-text-3">Recently viewed</p>
          <div className="mt-4 flex flex-wrap justify-center gap-4">
            {recent.map((p, i) => (
              <motion.button
                key={p.id}
                type="button"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.3 + i * 0.05, ease: EASE }}
                onClick={() => onSelect(p)}
                className="group flex flex-col items-center gap-1.5"
                title={p.name}
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full text-xs font-semibold text-text-1 transition-transform group-hover:-translate-y-0.5"
                  style={{
                    background:
                      'linear-gradient(var(--bg-2), var(--bg-2)) padding-box, var(--gradient-spectrum) border-box',
                    border: '2px solid transparent',
                  }}
                >
                  {initials(p.name)}
                </span>
                <span className="max-w-[72px] truncate text-[11px] text-text-3 group-hover:text-text-2">
                  {p.name.split(' ').slice(-1)[0]}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
