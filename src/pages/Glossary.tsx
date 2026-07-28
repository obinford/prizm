// Glossary — every column definition in the app, in one searchable view.
//
// This page is a VIEW over data that already exists: every ColumnDef carries
// source, definition and markets as required fields (enforced by the compiler
// since Step 1). No prose is written here — a definition that reads badly is
// a report item, not something to rewrite in one place and leave stale in the
// column. Duplicate keys across surfaces are shown, never merged away; where
// two surfaces define the same key differently, both definitions render with
// their surface labels — a divergence is information, not a bug to hide.
//
// Deep links: /glossary#kPct scrolls to and highlights that entry.

import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router'
import { Search } from 'lucide-react'
import type { ColumnDef } from '@/lib/columns'
import { PITCHER_COLUMNS, pitcherWindowColumns } from '@/lib/columns/mlbPitchers'
import { BATTER_COLUMNS, BATTER_ORDER_COLUMN, batterWindowColumns } from '@/lib/columns/mlbBatters'
import { BULLPEN_COLUMNS } from '@/lib/columns/mlbBullpen'
import { teamColumns } from '@/lib/columns/mlbTeams'
import { MLB_WINDOW_KEYS, MLB_WINDOW_LABELS } from '@/data/mlbPlayers'

interface Variant {
  surface: string
  definition: string
  source: string
}

interface GlossaryEntry {
  key: string
  label: string
  group?: string
  definition: string
  source: string
  markets?: string[]
  surfaces: string[]
  /** Present only when surfaces define this key differently. */
  variants?: Variant[]
}

/** One flat, deduped entry list over all four surfaces + window factories. */
function buildEntries(): GlossaryEntry[] {
  const surfaces: { name: string; columns: ColumnDef<any>[] }[] = [
    {
      name: 'Starters',
      columns: [
        ...PITCHER_COLUMNS,
        ...MLB_WINDOW_KEYS.flatMap((w) => pitcherWindowColumns(w, MLB_WINDOW_LABELS[w])),
      ],
    },
    {
      name: 'Batters',
      columns: [
        BATTER_ORDER_COLUMN,
        ...BATTER_COLUMNS,
        ...MLB_WINDOW_KEYS.flatMap((w) => batterWindowColumns(w, MLB_WINDOW_LABELS[w])),
      ],
    },
    { name: 'Bullpen', columns: BULLPEN_COLUMNS },
    // teamColumns takes league means for heat baselines; the glossary reads
    // only label/definition/source/markets, so empty means are correct here.
    { name: 'Team Stats', columns: teamColumns({}) },
  ]

  const byKey = new Map<string, { col: ColumnDef<any>; surface: string }[]>()
  for (const s of surfaces) {
    for (const col of s.columns) {
      const list = byKey.get(col.key)
      if (list) list.push({ col, surface: s.name })
      else byKey.set(col.key, [{ col, surface: s.name }])
    }
  }

  return [...byKey.entries()].map(([key, list]) => {
    const first = list[0].col
    const divergent = new Set(list.map((x) => x.col.definition)).size > 1
    return {
      key,
      label: first.label,
      group: first.group,
      definition: first.definition,
      source: first.source,
      markets: first.markets,
      surfaces: [...new Set(list.map((x) => x.surface))],
      variants: divergent
        ? list.map((x) => ({ surface: x.surface, definition: x.col.definition, source: x.col.source }))
        : undefined,
    }
  })
}

const ENTRIES = buildEntries()

/** Group order: first-seen across surfaces, unnamed groups last as 'Identity'. */
const GROUPS: string[] = (() => {
  const seen: string[] = []
  for (const e of ENTRIES) {
    const g = e.group ?? 'Identity'
    if (!seen.includes(g)) seen.push(g)
  }
  return seen
})()

const SURFACE_ORDER = ['Starters', 'Batters', 'Bullpen', 'Team Stats']

export default function Glossary() {
  const [query, setQuery] = useState('')
  const location = useLocation()
  const anchor = decodeURIComponent(location.hash.replace(/^#/, ''))

  useEffect(() => {
    if (!anchor) return
    document.getElementById(`g-${anchor}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [anchor])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ENTRIES
    return ENTRIES.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.key.toLowerCase().includes(q) ||
        e.definition.toLowerCase().includes(q),
    )
  }, [query])

  const byGroup = useMemo(() => {
    const map = new Map<string, GlossaryEntry[]>()
    for (const g of GROUPS) map.set(g, [])
    for (const e of filtered) {
      // Within a group, sort by surface order first, then label.
      map.get(e.group ?? 'Identity')!.push(e)
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          SURFACE_ORDER.indexOf(a.surfaces[0]) - SURFACE_ORDER.indexOf(b.surfaces[0]) ||
          a.label.localeCompare(b.label),
      )
    }
    return map
  }, [filtered])

  return (
    <div className="mx-auto max-w-[880px]">
      <header className="mb-6">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.02em] text-text-1">
          Glossary
        </h1>
        <p className="data-mono mt-1 text-[12px] text-text-3">
          {ENTRIES.length} entries · every column definition in the app, from the columns
          themselves — nothing written twice
        </p>
      </header>

      <div className="prizm-card mb-4 flex items-center gap-2.5 px-4 py-2.5">
        <Search size={15} className="shrink-0 text-text-3" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a stat or its definition…"
          aria-label="Search the glossary"
          className="data-mono h-7 w-full bg-transparent text-[13px] text-text-1 placeholder:text-text-3 focus:outline-none"
        />
      </div>

      {GROUPS.map((group) => {
        const list = byGroup.get(group) ?? []
        if (list.length === 0) return null
        return (
          <section key={group} className="mb-6">
            <p className="overline-caption mb-2 text-sp-indigo">{group}</p>
            <div className="space-y-2">
              {list.map((e) => (
                <article
                  key={e.key}
                  id={`g-${e.key}`}
                  className={`prizm-card scroll-mt-24 px-5 py-4 transition-colors ${
                    anchor === e.key ? 'border-sp-indigo' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="data-mono text-[14px] font-bold text-text-1">{e.label}</h3>
                    <span className="data-mono text-[10px] text-text-3">{e.key}</span>
                    <span className="ml-auto flex gap-1">
                      {e.surfaces.map((s) => (
                        <span
                          key={s}
                          className="overline-caption rounded-sm border border-line bg-bg-2 px-1.5 py-px text-text-3"
                        >
                          {s}
                        </span>
                      ))}
                    </span>
                  </div>

                  {e.variants ? (
                    <div className="mt-2 space-y-2">
                      {e.variants.map((v) => (
                        <p key={v.surface} className="text-[13px] leading-relaxed text-text-2">
                          <span className="overline-caption mr-1.5 text-sp-cyan">{v.surface}</span>
                          {v.definition}
                          <span className="data-mono ml-2 text-[10px] text-text-3">{v.source}</span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1.5 text-[13px] leading-relaxed text-text-2">{e.definition}</p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {!e.variants && (
                      <span className="data-mono text-[10px] text-text-3">{e.source}</span>
                    )}
                    {e.markets?.map((m) => (
                      <span
                        key={m}
                        className="rounded-sm border border-sp-indigo/40 bg-sp-indigo/10 px-1.5 py-px text-[10px] font-semibold text-sp-indigo"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )
      })}

      {filtered.length === 0 && (
        <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-[13px] text-text-3">
          No entries match “{query}”.
        </p>
      )}
    </div>
  )
}
