// Preset chip row ("Views") — Handigraphs' My Views, one click to narrow the
// table to a market's columns, click again to restore all. State is local to
// the tab; persisting views is Step 5 work.

import type { ColumnPreset } from '@/lib/columns'

export interface PresetChipsProps {
  presets: ColumnPreset[]
  /** The currently resolved preset key (from a chip or the Market filter). */
  preset: string | undefined
  onChange: (key: string | undefined) => void
}

export default function PresetChips({ presets, preset, onChange }: PresetChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="overline-caption text-text-3">Views</span>
      {presets.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onChange(preset === p.key ? undefined : p.key)}
          aria-pressed={preset === p.key}
          title={p.description}
          className={`data-mono rounded-sm px-2 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
            preset === p.key ? 'bg-bg-3 text-text-1' : 'text-text-3 hover:text-text-1'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
