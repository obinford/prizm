// GameCenter content — per-game AI reads, deterministic matchup history,
// and angle-statement builders. Derived from src/data seeds (no data edits).

import type { SlateGame } from '@/data/slate'
import { getPitcher, getTeamBatters } from '@/data/mlbPlayers'
import { getGoalie, getSkaters } from '@/data/nhlPlayers'
import { getGameProps, formatOdds, type PropLine } from '@/data/props'
import { deltaPct, formatDelta } from '@/lib/heat'

// ---------------------------------------------------------------------------
// Deterministic hash so "vs this pitcher" history is stable across reloads
// ---------------------------------------------------------------------------

// Batter-vs-pitcher career history was previously generated from a string hash
// ("3-for-11, 2 XBH") and rendered as fact. There is no BvP table in MySQL or
// Supabase, so it has been removed rather than approximated. If BvP is wanted
// later it needs a real source; note also that BvP is a weak signal at these
// sample sizes, so its absence costs little.

// ---------------------------------------------------------------------------
// AI reads — 2 authored variants for headline games + data-built fallback
// ---------------------------------------------------------------------------

// AUTHORED_READS previously held seven hand-written multi-paragraph essays keyed
// to specific game ids (mlb-nyy-bos, nhl-edm-cgy, ...), containing frozen
// specifics ("3.02 ERA", "9 mph out to left", ".931 SV% over L240") that were
// true only on the day they were written and were presented as generated
// analysis. Removed. Only the data-built read remains; a real generator is
// Phase 3.6.

export function generatedRead(game: SlateGame): string {
  if (game.sport === 'mlb') {
    const awayP = game.awayProbableId ? getPitcher(game.awayProbableId) : undefined
    const homeP = game.homeProbableId ? getPitcher(game.homeProbableId) : undefined
    const awayBat = getTeamBatters(game.away)
    const homeBat = getTeamBatters(game.home)
    const awayXbh =
      awayBat.length > 0
        ? awayBat.reduce((s, b) => s + deltaPct(b.windows.L60.xbh, b.xbh), 0) / awayBat.length
        : 0
    const homeXbh =
      homeBat.length > 0
        ? homeBat.reduce((s, b) => s + deltaPct(b.windows.L60.xbh, b.xbh), 0) / homeBat.length
        : 0
    const awayLine = awayP
      ? `${awayP.name} brings a ${awayP.era.toFixed(2)} ERA with a ${(awayP.kPct * 100).toFixed(1)}% strikeout rate`
      : `${game.away} has not named a starter`
    const homeLine = homeP
      ? `${homeP.name} counters at ${homeP.era.toFixed(2)} with a ${(homeP.xwoba).toFixed(3)} xwOBA`
      : `the ${game.home} starter is TBD`
    return `${awayLine}, and ${homeLine}. The ${game.away} lineup is running a ${formatDelta(awayXbh, 1)}% XBH delta over the L60 PA window, while ${game.home} sits at ${formatDelta(homeXbh, 1)}% — the side with the redder window owns the early-count leverage at ${game.venue}.${game.note ? ` ${game.note}.` : ''} ${game.total != null ? ` Total is ${game.total}.` : ''}`
  }
  const awayG = game.awayProbableId ? getGoalie(game.awayProbableId) : undefined
  const homeG = game.homeProbableId ? getGoalie(game.homeProbableId) : undefined
  const awaySkaters = getSkaters({ team: game.away })
  const homeSkaters = getSkaters({ team: game.home })
  const awayForm =
    awaySkaters.length > 0
      ? awaySkaters.reduce((s, p) => s + deltaPct(p.windows.MIN120.points, p.points), 0) /
        awaySkaters.length
      : 0
  const homeForm =
    homeSkaters.length > 0
      ? homeSkaters.reduce((s, p) => s + deltaPct(p.windows.MIN120.points, p.points), 0) /
        homeSkaters.length
      : 0
  const g1 = awayG ? `${awayG.name} (.${String(Math.round(awayG.svPct * 1000))} SV%)` : 'a TBD goalie'
  const g2 = homeG ? `${homeG.name} (.${String(Math.round(homeG.svPct * 1000))} SV%)` : 'a TBD goalie'
  return `${game.away} starts ${g1} against ${game.home}'s ${g2} at ${game.venue}. Skater form over the L120 MIN window: ${game.away} at ${formatDelta(awayForm, 1)}% and ${game.home} at ${formatDelta(homeForm, 1)}% vs season points pace.${game.note ? ` ${game.note}.` : ''} ${game.total != null ? ` Total is ${game.total}.` : ''}`
}


export function getAiReads(game: SlateGame): string[] {
  return [generatedRead(game)]
}

// ---------------------------------------------------------------------------
// Angle statement builder — turns a PropLine into editorial card copy
// ---------------------------------------------------------------------------

export interface GameAngle {
  id: string
  market: string
  statement: string
  deltaLine: string
  dPct: number
  confidence: 1 | 2 | 3
  priceAlert?: boolean
}

export function angleFromProp(prop: PropLine): GameAngle {
  const l10 = Math.round(prop.hitRates.L10 * 100)
  const score = prop.edgeScore ?? 50
  const confidence: 1 | 2 | 3 = score >= 75 ? 3 : score >= 60 ? 2 : 1
  const side = prop.overPrice <= prop.underPrice ? 'over' : 'under'
  return {
    id: prop.id,
    market: prop.market,
    statement: `${prop.player} ${side === 'over' ? 'over' : 'under'} ${prop.line} ${prop.market.toLowerCase()}`,
    deltaLine: `L10 hit rate ${l10}% · ${side} ${formatOdds(side === 'over' ? prop.overPrice : prop.underPrice)} ${prop.opponent}`,
    dPct: hitRateDelta(prop),
    confidence,
    priceAlert: prop.priceAlert,
  }
}

function hitRateDelta(prop: PropLine): number {
  return (prop.hitRates.L10 - 0.55) * 100
}

/** Angles for a game: props first, padded with data-built form angles. */
export function getGameAngles(game: SlateGame): GameAngle[] {
  const props = getGameProps(game.id)
    .sort((a, b) => (b.edgeScore ?? 0) - (a.edgeScore ?? 0))
    .slice(0, 4)
    .map(angleFromProp)

  const padded = [...props]

  if (game.sport === 'mlb') {
    // Starter-form angles for both probables
    const starterAngle = (id: string | undefined, opp: string, tag: string): GameAngle | null => {
      const p = id ? getPitcher(id) : undefined
      if (!p) return null
      const d = -deltaPct(p.windows.L120.xwoba, p.xwoba) // lower xwOBA allowed = good
      return {
        id: `gen-${game.id}-${tag}`,
        market: 'Strikeouts',
        statement: `${p.name} strikeout form holds vs ${opp}`,
        deltaLine: `L120 xwOBA ${p.windows.L120.xwoba.toFixed(3)} (${formatDelta(d, 1)}% vs season) · K% ${(p.kPct * 100).toFixed(1)}%`,
        dPct: d,
        confidence: d >= 5 ? 3 : d >= 0 ? 2 : 1,
      }
    }
    // Lineup-form angle from the away bats
    const lineupAngle = (): GameAngle | null => {
      const bats = getTeamBatters(game.away)
      if (bats.length === 0) return null
      const d = bats.reduce((s, b) => s + deltaPct(b.windows.L60.xbh, b.xbh), 0) / bats.length
      return {
        id: `gen-${game.id}-lu`,
        market: 'XBH',
        statement: `${game.away} lineup XBH delta vs ${game.home} pitching`,
        deltaLine: `L60 PA XBH ${formatDelta(d, 1)}% vs season across projected lineup`,
        dPct: d,
        confidence: Math.abs(d) >= 10 ? 3 : Math.abs(d) >= 5 ? 2 : 1,
      }
    }
    for (const a of [
      starterAngle(game.awayProbableId, game.home, 'asp'),
      starterAngle(game.homeProbableId, game.away, 'hsp'),
      lineupAngle(),
    ]) {
      if (padded.length >= 3) break
      if (a) padded.push(a)
    }
  } else {
    const goalieAngle = (id: string | undefined, opp: string, tag: string): GameAngle | null => {
      const g = id ? getGoalie(id) : undefined
      if (!g) return null
      const d = deltaPct(g.windows.MIN240.svPct, g.svPct)
      return {
        id: `gen-${game.id}-${tag}`,
        market: 'Saves',
        statement: `${g.name} form supports the saves volume vs ${opp}`,
        deltaLine: `L240 SV% .${String(Math.round(g.windows.MIN240.svPct * 1000))} (${formatDelta(d, 1)}% vs season)`,
        dPct: d,
        confidence: d >= 2 ? 3 : d >= 0.5 ? 2 : 1,
      }
    }
    const skaterAngle = (): GameAngle | null => {
      const skaters = getSkaters({ team: game.away })
      if (skaters.length === 0) return null
      const d =
        skaters.reduce((s, p) => s + deltaPct(p.windows.MIN120.points, p.points), 0) /
        skaters.length
      return {
        id: `gen-${game.id}-sk`,
        market: 'Points',
        statement: `${game.away} skaters trending vs ${game.home} at L120 MIN`,
        deltaLine: `L120 MIN points pace ${formatDelta(d, 1)}% vs season`,
        dPct: d,
        confidence: Math.abs(d) >= 10 ? 3 : Math.abs(d) >= 5 ? 2 : 1,
      }
    }
    for (const a of [
      goalieAngle(game.homeProbableId, game.away, 'hgk'),
      goalieAngle(game.awayProbableId, game.home, 'agk'),
      skaterAngle(),
    ]) {
      if (padded.length >= 3) break
      if (a) padded.push(a)
    }
  }
  return padded.slice(0, 4)
}
