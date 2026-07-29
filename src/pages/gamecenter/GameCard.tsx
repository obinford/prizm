import { motion } from 'framer-motion'
import { ArrowRight, CloudSun, MapPin, Wind } from 'lucide-react'
import type { SlateGame } from '@/data/slate'
import { getPitcher } from '@/data/mlbPlayers'
import { getGoalie } from '@/data/nhlPlayers'
import { getGameProps } from '@/data/props'
import { heatBg, deltaTextClass } from '@/lib/heat'
import { hitRateTint } from './utils'
import { getGameAngles } from './content'
import GameOdds from './GameOdds'

function starterHeadline(game: SlateGame, side: 'away' | 'home'): { name: string; line: string } {
  const id = side === 'away' ? game.awayProbableId : game.homeProbableId
  const name = side === 'away' ? game.awayProbable : game.homeProbable
  if (!id || !name) return { name: 'TBD', line: game.sport === 'mlb' ? 'probable' : 'expected' }
  if (game.sport === 'mlb') {
    const hand = (side === 'away' ? game.awayProbableHand : game.homeProbableHand) ?? getPitcher(id)?.throws
    const handSuffix = hand ? ` (${hand}HP)` : ''
    const p = getPitcher(id)
    return p ? { name: `${p.name}${handSuffix}`, line: `${p.era.toFixed(2)} ERA` } : { name: `${name}${handSuffix}`, line: '' }
  }
  const g = getGoalie(id)
  return g ? { name: g.name, line: `.${String(Math.round(g.svPct * 1000))} SV%` } : { name, line: '' }
}

/** Top angle preview chips for a game card (3 max, data-built fallback). */
function angleChips(game: SlateGame): { label: string; dPct: number }[] {
  const props = getGameProps(game.id)
    .sort((a, b) => (b.edgeScore ?? 0) - (a.edgeScore ?? 0))
    .slice(0, 3)
  if (props.length > 0) {
    return props.map((p) => ({
      label: `${p.player.split(' ').pop()} ${p.market} o${p.line}`,
      dPct: hitRateTint(p.hitRates.L10),
    }))
  }
  return getGameAngles(game)
    .slice(0, 3)
    .map((a) => ({
      label: a.statement.length > 36 ? `${a.statement.slice(0, 36)}…` : a.statement,
      dPct: a.dPct,
    }))
}

export default function GameCard({
  game,
  index,
  view,
  onSelect,
}: {
  game: SlateGame
  index: number
  view: 'grid' | 'list'
  onSelect: () => void
}) {
  const away = starterHeadline(game, 'away')
  const home = starterHeadline(game, 'home')
  const chips = angleChips(game)
  const noteIsWeather = game.note ? /wind|heat|°F/i.test(game.note) : false

  return (
    <motion.button
      type="button"
      layout="position"
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      onClick={onSelect}
      className={`group prizm-card w-full p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-line-strong ${
        view === 'list' ? 'flex flex-wrap items-center gap-x-8 gap-y-4' : ''
      }`}
    >
      {/* Top row: time + broadcast/venue + weather/park chip */}
      <div className={`flex flex-wrap items-center gap-2 ${view === 'grid' ? 'mb-4' : ''}`}>
        <span className="data-mono rounded-sm bg-bg-2 px-2 py-1 text-[12px] font-medium text-text-1">
          {game.startTime}
        </span>
        <span className="data-mono flex items-center gap-1 text-[11px] text-text-3">
          <MapPin size={11} /> {game.venue}
        </span>
        {game.sport === 'mlb' && noteIsWeather && (
          <span className="data-mono flex items-center gap-1 rounded-sm bg-sp-cyan/10 px-2 py-0.5 text-[11px] text-sp-cyan">
            <Wind size={11} /> {game.note}
          </span>
        )}
        {game.sport === 'mlb' && !noteIsWeather && (
          <span className="data-mono flex items-center gap-1 rounded-sm bg-sp-cyan/10 px-2 py-0.5 text-[11px] text-sp-cyan">
            <CloudSun size={11} /> {game.note ?? 'Park neutral'}
          </span>
        )}
        {game.sport === 'nhl' && game.note && (
          <span className="data-mono rounded-sm bg-bg-2 px-2 py-0.5 text-[11px] text-text-2">
            {game.note}
          </span>
        )}
      </div>

      {/* Matchup row */}
      <div className={view === 'list' ? 'min-w-[220px]' : ''}>
        <div className="flex items-baseline gap-3">
          <span className="font-display text-[22px] font-bold text-text-1">{game.away}</span>
          <span className="data-mono text-sm text-text-3">@</span>
          <span className="font-display text-[22px] font-bold text-text-1">{game.home}</span>
          {game.sport === 'mlb' && (
            <span className="ml-auto flex flex-wrap justify-end gap-1.5">
              <GameOdds game={game} />
            </span>
          )}
          {game.sport === 'nhl' && (
            <span
              className="data-mono ml-auto rounded-sm bg-bg-2 px-2 py-0.5 text-[11px] text-text-2"
              title="No game-odds feed for NHL — moneyline, puckline and totals need a game-odds source Prizm has not purchased."
            >
              O/U {game.total != null ? game.total.toFixed(1) : '—'}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[12px]">
          <span className="text-text-2">{away.name}</span>
          <span className="data-mono text-text-3">{away.line}</span>
          <span className="text-text-3">·</span>
          <span className="text-text-2">{home.name}</span>
          <span className="data-mono text-text-3">{home.line}</span>
        </div>
      </div>

      {/* Mini angle chips */}
      <div className={`flex flex-wrap items-center gap-2 ${view === 'grid' ? 'mt-4' : ''}`}>
        {chips.map((c) => (
          <span
            key={c.label}
            className={`data-mono rounded-sm px-2 py-1 text-[11px] font-medium transition-[filter] duration-300 group-hover:saturate-150 ${deltaTextClass(c.dPct)}`}
            style={{ backgroundColor: heatBg(c.dPct) }}
          >
            {c.label}
          </span>
        ))}
        <span className="data-mono ml-auto flex items-center gap-1 text-[12px] font-medium text-sp-indigo transition-colors group-hover:text-sp-cyan">
          Full breakdown <ArrowRight size={13} />
        </span>
      </div>
    </motion.button>
  )
}
