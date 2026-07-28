import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, ChevronLeft, Crosshair, RefreshCw, Sparkles } from 'lucide-react'
import type { SlateGame } from '@/data/slate'
import { getSlate } from '@/data/slate'
import {
  getTeamBatters,
  MLB_WINDOW_KEYS,
  MLB_WINDOW_LABELS,
} from '@/data/mlbPlayers'
import { getSkaters, NHL_WINDOW_KEYS, NHL_WINDOW_LABELS, type Skater } from '@/data/nhlPlayers'
import { PROPS, formatOdds } from '@/data/props'
import { trpc } from '@/providers/trpc'
import SplitTable, { type SplitPlayer } from '@/components/SplitTable'
import DataTable from '@/components/DataTable'
import type { ColumnDef } from '@/lib/columns'
import type { BatterRow } from '@/lib/columns/mlbBatters'
import { BATTER_COLUMNS, batterWindowColumns } from '@/lib/columns/mlbBatters'
import { getPitcher } from '@/data/mlbPlayers'
import { getGoalie } from '@/data/nhlPlayers'
import { deltaTextClass } from '@/lib/heat'
import { useProfileDrawer } from '@/pages/profiler/useProfileDrawer'
import { ConfidenceMeter, DeltaChip } from './kit'
import { saveAngle } from './utils'
import { getAiReads, getGameAngles } from './content'

// ---------------------------------------------------------------------------
// Matchup read paragraph — word-stagger reveal. The read is a deterministic
// template over live warehouse data (generatedRead in content.ts) — no model
// behind it, so the label must not say "AI".
// ---------------------------------------------------------------------------

function AiRead({ reads }: { reads: string[] }) {
  const [idx, setIdx] = useState(0)
  const text = reads[idx % reads.length]
  const words = useMemo(() => text.split(' '), [text])
  return (
    <div className="mt-5 rounded-lg border border-line bg-bg-2/60 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="overline-caption flex items-center gap-1.5 text-sp-indigo">
          <Sparkles size={13} /> Prizm read
        </span>
        {reads.length > 1 && (
          <button
            type="button"
            onClick={() => setIdx((i) => i + 1)}
            className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-[12px] font-medium text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
          >
            <RefreshCw size={12} /> Regenerate
          </button>
        )}
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={idx % reads.length}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="text-[15px] leading-relaxed text-text-2"
        >
          {words.map((w, i) => (
            <motion.span
              key={`${idx}-${i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18, delay: 0.008 * i }}
              className="inline-block whitespace-pre"
            >
              {w}{' '}
            </motion.span>
          ))}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Splits matrix data builders
// ---------------------------------------------------------------------------

// The MLB matrix renders through the shared DataTable (Step 2.4): BATTER_COLUMNS
// narrowed to AVG/SLG/XBH plus the four PA-window heat columns. The NHL matrix
// stays on SplitTable — NHL skater columns have no ColumnDef list yet and
// inventing one is out of scope, so SplitTable.tsx survives for that one
// consumer.

const MLB_MATRIX_STATS = ['avg', 'slg', 'xbh'] as const

const MLB_MATRIX_COLUMNS: ColumnDef<BatterRow>[] = [
  {
    key: 'player',
    label: 'Player',
    value: (r) => r.batter.name,
    source: 'MLB Stats API → players',
    definition: 'Batter.',
    sticky: true,
    minWidth: 170,
    render: (r) => (
      <>
        <span className="flex items-center gap-2 text-sm font-semibold text-text-1">
          {r.battingOrder != null && (
            <span
              className="data-mono flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-bg-3 text-[10px] font-bold text-text-2"
              title="Official batting-order spot"
            >
              {r.battingOrder}
            </span>
          )}
          {r.batter.name}
        </span>
        <span className="data-mono block text-[11px] text-text-3">
          {r.batter.team} · {r.batter.pos}
        </span>
      </>
    ),
  },
  ...BATTER_COLUMNS.filter((c) => (MLB_MATRIX_STATS as readonly string[]).includes(c.key)),
  ...MLB_WINDOW_KEYS.flatMap((k) =>
    batterWindowColumns(k, MLB_WINDOW_LABELS[k], MLB_MATRIX_STATS),
  ),
]

const NHL_COLS = [
  { key: 'sog', label: 'SOG', format: (v: number) => v.toFixed(1) },
  { key: 'goals', label: 'G', format: (v: number) => v.toFixed(2) },
  { key: 'points', label: 'PTS', format: (v: number) => v.toFixed(2) },
]

function skaterToSplit(s: Skater): SplitPlayer {
  return {
    id: s.id,
    name: s.name,
    team: s.team,
    pos: s.pos,
    season: { sog: s.sog, goals: s.goals, points: s.points },
    windows: Object.fromEntries(
      NHL_WINDOW_KEYS.map((k) => [
        k,
        { sog: s.windows[k].sog, goals: s.windows[k].goals, points: s.windows[k].points },
      ]),
    ),
    samples: Object.fromEntries(NHL_WINDOW_KEYS.map((k) => [k, s.windows[k].toi])),
    sampleUnit: 'MIN',
  }
}

// ---------------------------------------------------------------------------
// Related rail (S4)
// ---------------------------------------------------------------------------

function RelatedRail({ game, onSelect }: { game: SlateGame; onSelect: (id: string) => void }) {
  const others = getSlate()
    .filter((g) => g.id !== game.id)
    .sort((a, b) => (a.sport === game.sport ? 0 : 1) - (b.sport === game.sport ? 0 : 1))
    .slice(0, 4)
  const topEdge = [...PROPS].sort((a, b) => (b.edgeScore ?? 0) - (a.edgeScore ?? 0))[0]
  return (
    <motion.aside
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
      className="space-y-4"
    >
      <div className="prizm-card p-4">
        <p className="overline-caption mb-3 text-text-3">Also tonight</p>
        <div className="space-y-2">
          {others.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelect(g.id)}
              className="flex w-full items-center gap-3 rounded-md border border-line bg-bg-2 px-3 py-2.5 text-left transition-colors hover:bg-bg-3"
            >
              <span className="data-mono text-[11px] text-text-3">{g.startTime.replace(' ET', '')}</span>
              <span className="font-display text-sm font-semibold text-text-1">
                {g.away} @ {g.home}
              </span>
              <span className="data-mono ml-auto text-[10px] uppercase text-text-3">{g.sport}</span>
            </button>
          ))}
        </div>
      </div>

      {topEdge && (
        <Link to="/edgecenter" className="prizm-card group block p-4 transition-colors hover:border-line-strong">
          <p className="overline-caption mb-3 flex items-center gap-1.5 text-sp-indigo">
            <Crosshair size={13} /> Top edge of the slate
          </p>
          <p className="text-sm font-semibold text-text-1">{topEdge.player}</p>
          <p className="data-mono mt-0.5 text-[12px] text-text-2">
            {topEdge.market} o{topEdge.line} ({formatOdds(topEdge.overPrice)})
          </p>
          <div className="mt-3 flex items-center justify-between">
            <span
              className="data-mono rounded-sm px-2 py-0.5 text-[12px] font-bold text-white"
              style={{ background: 'var(--gradient-spectrum)' }}
            >
              {topEdge.edgeScore}
            </span>
            <span className="data-mono text-[11px] text-sp-indigo group-hover:text-sp-cyan">
              EdgeCenter →
            </span>
          </div>
        </Link>
      )}
    </motion.aside>
  )
}

// ---------------------------------------------------------------------------
// Game detail (S3)
// ---------------------------------------------------------------------------

export default function GameDetail({
  game,
  onBack,
  onSelect,
}: {
  game: SlateGame
  onBack: () => void
  onSelect: (id: string) => void
}) {
  const reads = useMemo(() => getAiReads(game), [game])
  const angles = useMemo(() => getGameAngles(game), [game])
  // Step 15 — profile drawer from any matrix row, over the detail view.
  const { openProfile, profileDrawer } = useProfileDrawer()

  const awayStarter = game.awayProbableId
    ? game.sport === 'mlb'
      ? getPitcher(game.awayProbableId)
      : undefined
    : undefined
  const homeStarter = game.homeProbableId
    ? game.sport === 'mlb'
      ? getPitcher(game.homeProbableId)
      : undefined
    : undefined
  const awayGoalie = game.awayProbableId
    ? game.sport === 'nhl'
      ? getGoalie(game.awayProbableId)
      : undefined
    : undefined
  const homeGoalie = game.homeProbableId
    ? game.sport === 'nhl'
      ? getGoalie(game.homeProbableId)
      : undefined
    : undefined

  // Step 6/13 — tonight's posted lineups (keyless statsapi schedule feed).
  // Posted → the matrix renders the full 9-man order per team, in order.
  // Not posted → the honest top-3 fallback below, labelled as such.
  const lineupsQuery = trpc.lineups.today.useQuery(undefined, { staleTime: 5 * 60_000, retry: 1 })
  const lineups = lineupsQuery.data
  const lineupPosted =
    game.sport === 'mlb' &&
    (((game.gamePk != null && lineups?.postedGamePks.includes(game.gamePk)) ?? false) ||
      (lineups?.lineupsPostedFor ?? []).includes(game.id))

  const mlbMatrixRows: BatterRow[] = useMemo(() => {
    if (game.sport !== 'mlb') return []
    if (lineupPosted && lineups?.slugs) {
      // Full batting order, 1–9, per team. Batters on Prizm's list but not in
      // the feed (call-ups, late scratches) are omitted — never re-ordered by
      // guessing. A spot the feed sent that Prizm has no batter for is skipped
      // by the same rule.
      const inOrder = (team: string): BatterRow[] =>
        getTeamBatters(team)
          .map((batter) => ({
            batter,
            battingOrder: lineups.slugs[batter.id]?.battingOrder ?? null,
          }))
          .filter((r) => r.battingOrder != null)
          .sort((a, b) => (a.battingOrder ?? 0) - (b.battingOrder ?? 0))
      return [...inOrder(game.away), ...inOrder(game.home)]
    }
    return [...getTeamBatters(game.home).slice(0, 3), ...getTeamBatters(game.away).slice(0, 3)].map(
      (batter) => ({ batter }),
    )
  }, [game, lineupPosted, lineups])

  const nhlMatrixPlayers: SplitPlayer[] = useMemo(() => {
    if (game.sport !== 'nhl') return []
    return [
      ...getSkaters({ team: game.home }).slice(0, 3),
      ...getSkaters({ team: game.away }).slice(0, 3),
    ].map(skaterToSplit)
  }, [game])

  // Batter-vs-pitcher history removed — it was hash-generated (see
  // gamecenter/content.ts). No BvP source exists; an empty list hides the
  // section rather than filling it with invented career lines.
  const historyChips: string[] = []

  const starterChip = (name?: string, line?: string, hand?: 'L' | 'R' | null) =>
    name ? (
      <span className="flex items-center gap-2 text-sm text-text-2">
        {name}
        {hand && <span className="data-mono text-[11px] font-semibold text-text-1">({hand}HP)</span>}
        {line && (
          <span className="data-mono rounded-sm bg-bg-2 px-1.5 py-0.5 text-[11px] text-text-1">{line}</span>
        )}
      </span>
    ) : (
      <span className="text-sm text-text-3">TBD</span>
    )

  return (
    <div>
      {/* Breadcrumb */}
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-1 text-sm font-medium text-text-2 transition-colors hover:text-text-1"
      >
        <ChevronLeft size={15} /> All games
      </button>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          {/* S3a — Matchup context hero band */}
          <motion.section
            key={game.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="prizm-card rounded-xl p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-3xl font-bold text-text-1">{game.away}</span>
                  <span className="data-mono text-text-3">@</span>
                  <span className="font-display text-3xl font-bold text-text-1">{game.home}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5">
                  {game.sport === 'mlb' ? (
                    <>
                      {starterChip(
                        awayStarter?.name ?? game.awayProbable,
                        awayStarter ? `${awayStarter.era.toFixed(2)} ERA` : undefined,
                        game.awayProbableHand ?? awayStarter?.throws ?? null,
                      )}
                      {starterChip(
                        homeStarter?.name ?? game.homeProbable,
                        homeStarter ? `${homeStarter.era.toFixed(2)} ERA` : undefined,
                        game.homeProbableHand ?? homeStarter?.throws ?? null,
                      )}
                    </>
                  ) : (
                    <>
                      {starterChip(awayGoalie?.name ?? game.awayProbable, awayGoalie ? `.${String(Math.round(awayGoalie.svPct * 1000))} SV%` : undefined)}
                      {starterChip(homeGoalie?.name ?? game.homeProbable, homeGoalie ? `.${String(Math.round(homeGoalie.svPct * 1000))} SV%` : undefined)}
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="data-mono rounded-sm border border-line bg-bg-2 px-2.5 py-1.5 text-[12px] text-text-2">
                  {game.venue}
                </span>
                <span
                  className="data-mono rounded-sm border border-line bg-bg-2 px-2.5 py-1.5 text-[12px] text-text-2"
                  title={
                    game.total == null
                      ? 'No game-odds feed — sv_odds covers player props only. Moneyline, runline and totals need a game-odds source Prizm has not purchased.'
                      : undefined
                  }
                >
                  O/U {game.total != null ? game.total.toFixed(1) : '—'}
                </span>
                <span className="data-mono rounded-sm border border-line bg-bg-2 px-2.5 py-1.5 text-[12px] text-text-2">
                  {game.startTime}
                </span>
              </div>
            </div>

            <AiRead reads={reads} />
          </motion.section>

          {/* S3b — Recent splits matrix */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="overline-caption text-text-3">
                {game.sport === 'mlb'
                  ? lineupPosted
                    ? 'Starting lineups vs the starters — official batting order'
                    : 'Key bats vs the starters'
                  : 'Skaters vs the netminders'}
              </p>
              {game.sport === 'mlb' && !lineupPosted && (
                <span
                  className="data-mono rounded-sm bg-bg-2 px-2 py-1 text-[11px] text-text-3"
                  title="MLB teams typically post lineups 3–4 hours before first pitch"
                >
                  Lineup not posted yet — the full 9-man order appears here when it is
                </span>
              )}
              {historyChips.map((c) => (
                <span
                  key={c}
                  className="data-mono rounded-sm bg-bg-2 px-2 py-1 text-[11px] text-text-2"
                >
                  {c}
                </span>
              ))}
            </div>
            {game.sport === 'mlb' ? (
              <DataTable<BatterRow>
                columns={MLB_MATRIX_COLUMNS}
                rows={mlbMatrixRows}
                rowKey={(r) => r.batter.id}
                emptyLabel="No batters available for this game"
                provenance="Recent splits matrix — L30 to L120 PA"
                onOpenProfile={(r) => openProfile(r.batter.id)}
                mobileTitle={(r) => r.batter.name}
                mobileSummary={(r) =>
                  `${r.batter.team} · ${r.batter.pos} · AVG ${r.batter.avg.toFixed(3)}`
                }
              />
            ) : (
              <SplitTable
                players={nhlMatrixPlayers}
                columns={NHL_COLS}
                windows={NHL_WINDOW_KEYS.map((k) => ({ key: k, label: NHL_WINDOW_LABELS[k] }))}
                title="Recent form matrix — 60 to 240 MIN"
              />
            )}
          </motion.section>

          {/* S3c — Betting angles */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.18 }}
          >
            <p className="overline-caption mb-3 text-text-3">Betting angles</p>
            <div className="space-y-3">
              {angles.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.45, delay: 0.25 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-start gap-4 rounded-md border border-line bg-bg-2 p-4"
                >
                  <span className="font-display text-2xl font-bold text-text-3/70">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="data-mono rounded-sm bg-sp-indigo/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sp-indigo">
                        {a.market}
                      </span>
                      <p className="text-[15px] font-semibold text-text-1">{a.statement}</p>
                    </div>
                    <p className={`data-mono mt-1.5 text-[12px] ${deltaTextClass(a.dPct)}`}>{a.deltaLine}</p>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
                      <ConfidenceMeter level={a.confidence} delay={0.3 + i * 0.08} />
                      <button
                        type="button"
                        onClick={() =>
                          saveAngle({ title: a.statement, subtitle: a.deltaLine, source: 'GameCenter' })
                        }
                        className="flex items-center gap-1.5 rounded-sm border border-line bg-bg-1 px-2.5 py-1.5 text-[12px] font-medium text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
                      >
                        <Bookmark size={13} /> Add to My Angles
                      </button>
                    </div>
                  </div>
                  {a.priceAlert && (
                    <DeltaChip dPct={12} label="Price alert" icon="zap" className="hidden sm:inline-flex" />
                  )}
                </motion.div>
              ))}
            </div>
          </motion.section>
        </div>

        {/* S4 — Related rail */}
        <RelatedRail game={game} onSelect={onSelect} />
      </div>

      {profileDrawer}
    </div>
  )
}
