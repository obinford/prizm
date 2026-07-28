/**
 * Export the rows currently in view, through the same ColumnDef list the table
 * renders. What you see is what you get: same columns, same order, same sort,
 * same rules. Values are RAW (col.value), not formatted — a CSV is a data
 * handoff, and re-parsing "24.1%" in a spreadsheet is worse than reading 24.1.
 */

import type { ColumnDef } from '@/lib/columns'

export function toCsv<Row>(columns: ColumnDef<Row>[], rows: Row[]): string {
  const cols = columns.filter((c) => c.key !== 'actions')
  const esc = (v: unknown): string => {
    if (v == null) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = cols.map((c) => esc(c.label)).join(',')
  const body = rows.map((r) => cols.map((c) => esc(c.value(r))).join(',')).join('\n')
  return `${head}\n${body}`
}

/**
 * Provenance line that travels with every export. A CSV that leaves the app
 * without saying where its numbers came from is exactly the artefact this
 * project exists to not produce.
 *
 * It is appended as the LAST line, not prepended as the first. CSV has no
 * comment syntax — a leading `# ...` row is read as data, so the real header
 * lands on row 2 and every consumer breaks. Verified: pandas.read_csv on a
 * file with a leading `#` line returns ONE column named after the comment.
 * Excel and Sheets do the same. Trailing keeps the header on row 1, where
 * every parser expects it, and the provenance still ships inside the file.
 */
export function csvProvenanceLine(parts: (string | undefined)[]): string {
  return `# ${parts.filter(Boolean).join(' · ')}`
}

/** Header row first, data, provenance last. See csvProvenanceLine. */
export function withProvenance(csv: string, provenanceLine: string): string {
  return `${csv}\n${provenanceLine}`
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
