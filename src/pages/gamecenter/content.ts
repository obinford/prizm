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

function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Fake-but-stable career history line, e.g. "3-for-11, 2 XBH". */
export function vsHistory(batterId: string, pitcherId: string): string {
  const h = hash(`${batterId}::${pitcherId}`)
  const ab = 7 + (h % 14) // 7–20 AB
  const hits = Math.max(1, Math.round(ab * (0.18 + ((h >> 4) % 30) / 100)))
  const xbh = (h >> 9) % 4
  return `${hits}-for-${ab}${xbh > 0 ? `, ${xbh} XBH` : ''}`
}

// ---------------------------------------------------------------------------
// AI reads — 2 authored variants for headline games + data-built fallback
// ---------------------------------------------------------------------------

const AUTHORED_READS: Record<string, string[]> = {
  'mlb-nyy-bos': [
    "Boston's projected lineup is running a +14% XBH delta over the L60 PA window against left-handed pitching, and Max Fried has allowed harder contact to righty bats on the road than his 3.02 ERA suggests. The wind-out-to-left report at Fenway inflates pull-side carry for both dugouts. Judge's L30 slugging window is the single reddest cell on this slate — the angle is New York's top four against Crochet's creeping walk rate.",
    'This profiles as a batters\u2019 night disguised as a pitchers\u2019 duel. Fried and Crochet both carry sub-3.20 ERAs, but Fenway with 9 mph out to left has played +8% for XBH this season. New York\u2019s lineup owns a .336 wOBA over the L120 PA window, and Crochet\u2019s BB% vs righties has drifted up across his last three starts.',
  ],
  'mlb-lad-sf': [
    'Oracle Park suppresses right-handed power by roughly 11%, which matters for a Dodgers lineup built on righty thump. Yamamoto\u2019s L120 window shows his best splitter form of the season — a 0.270 season xwOBA that tightens to the low .240s recently. Webb\u2019s ground-ball profile travels well at home; the under angles and Yamamoto strikeouts are where the spectrum glows red.',
    'The Giants\u2019 lineup has quietly posted a +9% XBH delta over the L60 PA window, but Yamamoto is the wrong arm to chase it against — his K% holds above 29% in every window. Los Angeles counters with the league\u2019s deepest top five; Webb\u2019s home ERA is strong, yet his hard-hit rate to lefties has crept up across the L90 window.',
  ],
  'mlb-phi-atl': [
    'Chris Sale at home has been the NL\u2019s toughest lefty over the L120 window, and Philadelphia\u2019s right-handed core historically fights his slider uphill. Cristopher S\u00e1nchez counters with a 2.90s-profile built on weak contact, but Atlanta\u2019s lineup is running a +11% total-bases delta over the L60 window. The angle spectrum tilts toward Atlanta bats and Sale strikeouts.',
    'An NL East swing game with two arms trending opposite directions. S\u00e1nchez\u2019s walk rate has doubled across his last two starts — small sample, but Atlanta punishes free passes better than anyone. Sale\u2019s K% is above 30% in every rolling window, and Truist Park plays neutral enough that his strikeout line is the cleanest read on the board.',
  ],
  'mlb-det-cle': [
    'Tarik Skubal carries a 31.2% season K rate into Progressive Field against a Cleveland lineup whiffing 26% against left-handed pitching over the last month. His L120 batters-faced window shows the best xwOBA of his season, so form and matchup point the same direction. Gavin Williams has the stuff to trade zeroes early — the first-five market is where this game tilts red.',
    'Cleveland\u2019s contact-first lineup is a poor stylistic fit against peak Skubal: they don\u2019t walk, and his put-away rate with two strikes is elite in every window. The Tigers\u2019 own bats face a stern test in Williams, whose fastball velocity is up a tick over the L60 window. Expect a low-total game decided by which ace blinks first.',
  ],
  'mlb-hou-tex': [
    'The Silver Boot series pairs two of the AL\u2019s form arms. Jacob deGrom\u2019s 2.96 ERA understates how dominant his L120 window has been at home, and Houston\u2019s lineup is running a slightly blue XBH delta over the L30 window. Hunter Brown\u2019s strikeout floor travels, but Texas\u2019 right-handed power matches up well with his four-seam-heavy mix at Globe Life.',
    'deGrom at home with a 7.0 total tells you where the books stand. Houston\u2019s best angle is Brown\u2019s swing-and-miss carrying against a Rangers lineup that strikes out 24% of the time versus righties. The Astros\u2019 bullpen is rested, which shortens the game if their starter wobbles early.',
  ],
  'nhl-edm-cgy': [
    'The Battle of Alberta has averaged 7.2 total goals this season, and both goalies enter with heavy recent workloads. McDavid\u2019s L120 MIN window is tracking more than 40% above his season points pace, and Calgary concedes top-five slot volume league-wide. Dustin Wolf\u2019s .931 SV% over the L240 MIN window is the counterweight — saves volume is the reddest angle on this sheet.',
    'Edmonton brings league-best rush volume on the road (33.8 SOG), which is exactly the profile that keeps Wolf busy enough to clear his saves line even if his otherworldly L240 form regresses. Skinner has been streaky against Calgary\u2019s cycle game. Expect pace, special-teams swings, and a second-period goal burst.',
  ],
  'nhl-tb-fla': [
    'A goaltending showcase: Vasilevskiy and Bobrovsky both own top-eight season GSAx marks, and Florida\u2019s structured home game suppresses rush chances. Tampa\u2019s power play is the swing factor — it\u2019s converting 28% over the last two weeks. Kucherov\u2019s points windows are neutral-to-red across every timeframe; the under and goalie saves props carry the edge here.',
    'Sunshine State games between these two rarely open up early. Bobrovsky\u2019s L240 MIN window shows his steadiest form since March, while Vasilevskiy\u2019s rebound control has wobbled against high slot volume — Florida generates plenty. Reinhart\u2019s goal line at plus money is the value chip on an otherwise defensive card.',
  ],
}

/** Data-built read used as a variant for every game (and base for others). */
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
    return `${awayLine}, and ${homeLine}. The ${game.away} lineup is running a ${formatDelta(awayXbh, 1)}% XBH delta over the L60 PA window, while ${game.home} sits at ${formatDelta(homeXbh, 1)}% — the side with the redder window owns the early-count leverage at ${game.venue}.${game.note ? ` ${game.note}.` : ''} Watch the total at ${game.total ?? 8.5}: both pens are rested behind the aces.`
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
  return `${game.away} starts ${g1} against ${game.home}'s ${g2} at ${game.venue}. Skater form over the L120 MIN window: ${game.away} at ${formatDelta(awayForm, 1)}% and ${game.home} at ${formatDelta(homeForm, 1)}% vs season points pace.${game.note ? ` ${game.note}.` : ''} With the total at ${game.total ?? 6.0}, the saves and shot-volume props carry the cleanest edges on this matchup.`
}

export function getAiReads(game: SlateGame): string[] {
  const authored = AUTHORED_READS[game.id] ?? []
  const generated = generatedRead(game)
  return authored.length > 0 ? [...authored, generated] : [generated]
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
