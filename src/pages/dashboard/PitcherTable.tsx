// Pitchers tab — now rendered by the shared DataTable.
//
// This file used to be 569 lines of hand-rolled table: its own header markup,
// sort state, heat cells, delta chips, null handling, tooltips, skeleton and
// mobile cards — all duplicated from four other tables. It is now a column list
// plus the pitcher-specific bits DataTable does not own (the Edge gauge, the
// "+ Angle" row action, and the drawer).
//
// Adding a column is now an edit to src/lib/columns/mlbPitchers.ts. Adding a
// sport is a new column list. Nothing here changes.

import { useEffect, useMemo, useState } from 'react'
import { BookmarkPlus, Flame } from 'lucide-react'
import type { MlbWindowKey } from '@/data/mlbPlayers'
import { MLB_WINDOW_LABELS } from '@/data/mlbPlayers'
import DataTable from '@/components/DataTable'
import RuleBuilder from '@/components/RuleBuilder'
import type { ColumnDef } from '@/lib/columns'
import type { FilterRule, RegisterRules } from '@/lib/filterRules'
import { applyRules, describeRule } from '@/lib/filterRules'
import type { PitcherRow } from '@/lib/columns/mlbPitchers'
import { PITCHER_COLUMNS, PITCHER_PRESETS, pitcherWindowColumns } from '@/lib/columns/mlbPitchers'
import type { SplitKey, StarterEntry } from './utils'
import { edgeScore, splitStat } from './utils'
import { AnglePopover, Toast } from './angles'
import { addToAngle, useToast } from './angleStore'
import PitcherDrawer from './PitcherDrawer'
import LegendStrip from './Legend'
import PresetChips from './PresetChips'

export type StatKey = 'era' | 'whip' | 'kPct' | 'bbPct' | 'xwoba'

/** Columns that always render, whatever preset is active. */
const ALWAYS_SHOW = ['team', 'throws', 'opponent']

/** Season stats that must respect the active split filter. */
const SPLITTABLE: StatKey[] = ['era', 'whip', 'kPct', 'bbPct', 'xwoba']

/**
 * Market filter → column preset. The dashboard's `Market` chip maps onto the
 * same market-keyed presets Handigraphs exposes as My Views chips.
 */
const MARKET_TO_PRESET: Record<string, string> = {
  ks: 'k',
  hits: 'h',
  er: 'er',
  outs: 'er',
  hr: 'hr',
  bb: 'bb',
}

export interface PitcherTableProps {
  entries: StarterEntry[]
  loading: boolean
  market: string | undefined
  windows: MlbWindowKey[]
  split: SplitKey | undefined
  /** bump on any filter change to replay the re-tint sweep + row restagger */
  filterSig: string
  onResetFilters: () => void
  /** Registers this tab's rule state with the dashboard for saved views. */
  registerRules?: RegisterRules
}

export default function PitcherTable({
  entries,
  loading,
  market,
  windows,
  split,
  filterSig,
  onResetFilters,
  registerRules,
}: PitcherTableProps) {
  const [selected, setSelected] = useState<StarterEntry | null>(null)
  const [angleFor, setAngleFor] = useState<string | null>(null)
  const [toast, showToast] = useToast()
  // Views chip row (Step 2.3). Three states, not two:
  //   undefined → no chip choice, the Market filter's mapping decides
  //   null      → explicitly cleared, overrides Market, all columns show
  //   string    → explicit chip
  // Collapsing null into undefined makes a Market-lit chip unclickable.
  const [presetChip, setPresetChip] = useState<string | null | undefined>(undefined)
  const marketPreset = market ? MARKET_TO_PRESET[market] : undefined
  const activePresetKey = presetChip === undefined ? marketPreset : (presetChip ?? undefined)

  // A new Market selection re-arms the mapping, so an old explicit clear does
  // not silently disable the Market filter for the rest of the session.
  useEffect(() => {
    setPresetChip(undefined)
  }, [market])

  // Step 4 — numeric/text rules over the rendered ColumnDef list. State stays
  // tab-local (rules are column-scoped); the dashboard saves/restores them
  // through this registration for saved views.
  const [rules, setRules] = useState<FilterRule[]>([])
  useEffect(() => {
    registerRules?.({ rules, apply: setRules })
    return () => registerRules?.(null)
  }, [rules, registerRules])

  const saveAngle = (entry: StarterEntry) => (angleId: string | null, newName?: string) => {
    addToAngle(angleId, newName, {
      id: entry.pitcher.id,
      kind: 'mlb-pitcher',
      label: entry.pitcher.name,
      meta: `${entry.pitcher.team} · ${entry.pitcher.throws}HP vs ${entry.opp}`,
    })
    setAngleFor(null)
    showToast('Added to angle')
  }

  const columns = useMemo<ColumnDef<PitcherRow>[]>(() => {
    // 1. Sticky identity cell — name over team / hand / opponent.
    const identity: ColumnDef<PitcherRow> = {
      key: 'player',
      label: 'Player',
      value: (r) => r.pitcher.name,
      source: 'MLB Stats API → players',
      definition: 'Tonight’s probable starter.',
      sticky: true,
      minWidth: 190,
      render: (r) => (
        <>
          <span className="block text-sm font-semibold text-text-1">{r.pitcher.name}</span>
          <span className="data-mono block text-[11px] text-text-3">
            {r.pitcher.team} · {r.pitcher.throws}HP vs {r.opp}
          </span>
        </>
      ),
    }

    // 2. Season + Statcast columns, narrowed by the active preset (chip or market).
    const preset = activePresetKey
      ? PITCHER_PRESETS.find((p) => p.key === activePresetKey)
      : undefined
    const wanted = preset ? new Set([...ALWAYS_SHOW, ...preset.columns]) : null

    const stats: ColumnDef<PitcherRow>[] = PITCHER_COLUMNS.filter(
      (c) => !wanted || wanted.has(c.key),
    ).map((c) => {
      if (!SPLITTABLE.includes(c.key as StatKey)) return c
      // Season values respect the active split. A split with no source dashes
      // out rather than falling back to the unsplit season number — that
      // fallback is what splitFactor() used to hide.
      return {
        ...c,
        value: (r: PitcherRow) => splitStat(r.pitcher, split, c.key as StatKey),
        missingHint: split
          ? `No ${c.label} available for this split — sv_stat_cache split rows carry K%, BB% and Statcast rates only.`
          : undefined,
      }
    })

    // 3. Rolling-window heat columns, one group per active window.
    const windowCols = windows.flatMap((w) =>
      pitcherWindowColumns(w, MLB_WINDOW_LABELS[w], preset?.key === 'k' ? ['kPct'] : undefined),
    )

    // 4. Pitcher-specific: Edge gauge and the "+ Angle" row action.
    const edge: ColumnDef<PitcherRow> = {
      key: 'edge',
      label: 'Edge',
      value: (r) => edgeScore(r.pitcher),
      source: 'Derived: mean(ΔK% − ΔERA) across rolling windows',
      definition:
        'A 0–100 composite of rolling-window form. Unvalidated and price-blind — it ranks form, it does not price a bet.',
      sortable: true,
      render: (r) => {
        const e = edgeScore(r.pitcher)
        return (
          <span className="flex items-center justify-center gap-1.5">
            <span className="data-mono text-[13px] font-bold text-text-1">{e}</span>
            {e >= 75 && <Flame size={12} className="text-pos" />}
          </span>
        )
      },
    }

    const actions: ColumnDef<PitcherRow> = {
      key: 'actions',
      label: '',
      value: () => null,
      source: '—',
      definition: 'Save this pitcher to an angle.',
      render: (r) => (
        <span className="relative inline-flex">
          <button
            type="button"
            aria-label={`Add ${r.pitcher.name} to an angle`}
            onClick={(e) => {
              e.stopPropagation()
              setAngleFor(angleFor === r.pitcher.id ? null : r.pitcher.id)
            }}
            className={`rounded p-1 transition-opacity ${
              angleFor === r.pitcher.id
                ? 'text-sp-magenta opacity-100'
                : 'opacity-60 hover:opacity-100'
            }`}
          >
            <BookmarkPlus size={14} />
          </button>
          {angleFor === r.pitcher.id && (
            <AnglePopover onPick={saveAngle(r)} onClose={() => setAngleFor(null)} />
          )}
        </span>
      ),
    }

    return [identity, ...stats, ...windowCols, edge, actions]
    // saveAngle closes over stable setters; angleFor drives the popover only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePresetKey, windows, split, angleFor])

  const provenance = split
    ? 'Split view · real Statcast splits only. ERA and WHIP have no split source and show —, as do rolling windows (sv splits are season-level).'
    : undefined

  // Rules resolve through ColumnDef.value(row) against the rendered columns.
  const visible = useMemo(() => applyRules(rules, columns, entries), [rules, columns, entries])

  const handleReset = () => {
    setRules([])
    onResetFilters()
  }

  return (
    <div className="space-y-3">
      <div className="prizm-card px-5 py-3">
        <LegendStrip />
      </div>

      {/* Views chip row — narrows columns to a market preset, click again to clear */}
      <div className="prizm-card px-5 py-3">
        <PresetChips presets={PITCHER_PRESETS} preset={activePresetKey} onChange={setPresetChip} />
      </div>

      {/* Rule builder — arbitrary predicates over the rendered columns */}
      <div className="prizm-card px-5 py-3">
        <RuleBuilder columns={columns} rules={rules} onChange={setRules} sampleRows={entries} />
      </div>

      <DataTable<PitcherRow>
        columns={columns}
        rows={visible}
        rowKey={(r) => r.pitcher.id}
        loading={loading}
        filterSig={`${filterSig}:${JSON.stringify(rules)}`}
        onRowClick={(r) => setSelected(r)}
        onResetFilters={handleReset}
        emptyLabel={
          rules.length > 0
            ? `No starters match these filters and ${rules.length} rule${rules.length === 1 ? '' : 's'}`
            : 'No starters match these filters'
        }
        provenance={provenance}
        defaultSortKey="edge"
        defaultSortDir={-1}
        exportName="prizm-starters"
        exportFilters={
          rules.length > 0 ? rules.map((r) => describeRule(r, columns)).join(', ') : undefined
        }
        mobileTitle={(r) => r.pitcher.name}
        mobileSummary={(r) =>
          `${r.pitcher.team} · ${r.pitcher.throws}HP vs ${r.opp} · Edge ${edgeScore(r.pitcher)}`
        }
        // Step 10.1 — the heat is the product on Starters; the heat columns
        // are exactly the active rolling-window columns (preset narrowing
        // included), resolved from the same ColumnDef list as desktop.
        mobileColumns={columns.filter((c) => c.heat).map((c) => c.key)}
      />

      <PitcherDrawer
        entry={selected}
        split={split}
        onClose={() => setSelected(null)}
        onToast={showToast}
      />
      <Toast message={toast} />
    </div>
  )
}
