// Ask Prizm — page-level canned answers that complement src/data/askResponses.ts
// (which we cannot modify). Covers the design.md suggested prompts that the
// seed matcher would otherwise fall back on. resolveAsk() scores both sets.

import { ASK_RESPONSES, ASK_FALLBACK, type AskResponse } from '@/data/askResponses'

export const EXTRA_RESPONSES: AskResponse[] = [
  {
    id: 'ask-lefty-home',
    keywords: ['lefties', 'lefty', 'starters', 'hit hardest', 'left-handed', 'home'],
    question: 'Which starters get hit hardest by lefties at home?',
    answer:
      'Three starters stand out — and not in a good way. Quinn Priester has allowed a .338 xwOBA to left-handed bats at American Family Field, 16% worse than his season mark, which puts Cubs lefties like Michael Busch squarely on the XBH card tonight. Gavin Williams (.311 xwOBA vs LHB at home) and Freddy Peralta (.304) round out the list. The pattern: fly-ball righties with below-average changeups get punished by opposite-handed pull power in their own parks.',
    table: {
      columns: ['Starter', 'Hand', 'Home xwOBA vs LHB', 'Season xwOBA', 'Δ vs season'],
      rows: [
        ['Quinn Priester', 'R', '.338', '.291', '+16.2%'],
        ['Gavin Williams', 'R', '.311', '.282', '+10.3%'],
        ['Freddy Peralta', 'R', '.304', '.279', '+9.0%'],
        ['Garrett Crochet', 'L', '.251', '.268', '−6.3%'],
      ],
      heatColumn: 4,
    },
    sources: ['mlbPlayers.ts · quinn-priester', 'mlbPlayers.ts · gavin-williams', 'slate.ts · mlb-chc-mil'],
  },
  {
    id: 'ask-bullpens-fading',
    keywords: ['bullpen', 'bullpens', 'fading', 'relievers', 'relief', 'two weeks'],
    question: 'Show me bullpens fading over the last two weeks.',
    answer:
      'Two pens are tinting deep blue. Washington\u2019s relief corps owns a 5.83 ERA over the L14 days with a walk rate up 34% vs its season baseline — that inflates every Mets total-bases prop tonight. Oakland\u2019s pen (5.41 ERA L14) is nearly as shaky, which stacks with the Sutter Health heat angle. On the flip side, Cleveland\u2019s pen is the reddest unit on the slate at 2.10 over the same window — trust Guardians unders late.',
    table: {
      columns: ['Bullpen', 'Season ERA', 'L14 ERA', 'Δ vs season'],
      rows: [
        ['Washington', '4.12', '5.83', '−41.5%'],
        ['Athletics', '4.35', '5.41', '−24.4%'],
        ['San Francisco', '3.98', '4.62', '−16.1%'],
        ['Cleveland', '3.05', '2.10', '+31.1%'],
      ],
      heatColumn: 3,
    },
    sources: ['mlbTeams.ts · WSH', 'mlbTeams.ts · ATH', 'slate.ts · mlb-nym-wsh'],
  },
  {
    id: 'ask-xbh-rhp',
    keywords: ['xbh rate', 'rhp', 'highest xbh', 'extra-base', 'l60 window'],
    question: 'Who has the highest XBH rate vs RHP in the L60 window?',
    answer:
      'Aaron Judge, and it is not close. He is producing 0.96 XBH per game against right-handed pitching over the L60 PA window — 23% above his season rate — with a .712 SLG in the split. Kyle Schwarber (0.88, +18%) and Junior Caminero (0.81, +14%) are the next two names. All three face right-handers tonight except Judge, who draws the lefty Crochet — his XBH rate vs LHP is still +9% red, so the angle survives.',
    table: {
      columns: ['Player', 'Split', 'L60 XBH/G', 'Season XBH/G', 'Δ'],
      rows: [
        ['Aaron Judge', 'vs RHP', 0.96, 0.78, '+23.1%'],
        ['Kyle Schwarber', 'vs RHP', 0.88, 0.74, '+18.9%'],
        ['Junior Caminero', 'vs RHP', 0.81, 0.71, '+14.1%'],
        ['Shohei Ohtani', 'vs RHP', 0.79, 0.75, '+5.3%'],
      ],
      heatColumn: 4,
    },
    sources: ['mlbPlayers.ts · aaron-judge', 'mlbPlayers.ts · kyle-schwarber', 'props.ts · prop-1'],
  },
  {
    id: 'ask-tb-slate',
    keywords: ['total-bases', 'total bases', 'tb props', 'bases props', 'slate'],
    question: 'Best total-bases props on tonight\u2019s slate?',
    answer:
      'Three total-bases overs clear the bar tonight. Corbin Carroll o1.5 at even money is the best pure number — an 80% L10 hit rate against a bullpen that ranks bottom-five in slugging allowed. Cal Raleigh o1.5 at +105 is the price play: 70% over the L10 with 96\u00b0F carry at Sutter Health, and Aaron Judge o1.5 at -115 is the volume play with a 75% L20 hit rate behind him. All three tint red across every window from L5 to L20.',
    table: {
      columns: ['Player', 'Line', 'L5', 'L10', 'L20', 'Price'],
      rows: [
        ['Corbin Carroll', 'o1.5', '70%', '80%', '60%', '+100'],
        ['Cal Raleigh', 'o1.5', '80%', '70%', '60%', '+105'],
        ['Aaron Judge', 'o1.5', '80%', '70%', '75%', '−115'],
        ['Bobby Witt Jr.', 'o1.5', '60%', '70%', '65%', '−105'],
      ],
    },
    sources: ['props.ts · prop-12', 'props.ts · prop-9', 'props.ts · prop-7'],
  },
  {
    id: 'ask-jays-april',
    keywords: ['blue jays', 'toronto', 'since april', 'changed', 'lineup'],
    question: 'What changed for the Blue Jays lineup since April?',
    answer:
      'The short version: the top of the order woke up and the bottom stopped giving at-bats away. Since May 1, Toronto\u2019s 1–4 hitters are running a +12% total-bases delta vs April, driven by Guerrero Jr.\u2019s hard-hit rate jumping nine points. The caveat for tonight: their splits tilt heavily against right-handed pitching, and the current window vs lefties is actually 8% below the season baseline — pick the matchup, not the narrative.',
    table: {
      columns: ['Split', 'April', 'Since May 1', 'Δ'],
      rows: [
        ['TB/G (1–4 hitters)', 5.9, 6.6, '+11.9%'],
        ['XBH/G (team)', 2.4, 2.7, '+12.5%'],
        ['BB% (team)', '7.8%', '8.9%', '+14.1%'],
        ['TB/G vs LHP', 3.1, 2.9, '−6.5%'],
      ],
      heatColumn: 3,
    },
    sources: ['mlbTeams.ts · TOR', 'mlbPlayers.ts · vladimir-guerrero-jr'],
  },
]

const ALL_RESPONSES: AskResponse[] = [...ASK_RESPONSES, ...EXTRA_RESPONSES]

/** Score-based matcher across seed + page-level responses. */
export function resolveAsk(query: string): AskResponse {
  const q = query.toLowerCase()
  let best: AskResponse | null = null
  let bestScore = 0
  for (const r of ALL_RESPONSES) {
    let score = 0
    for (const k of r.keywords) {
      if (q.includes(k)) score += k.length > 4 ? 2 : 1
    }
    if (score > bestScore) {
      bestScore = score
      best = r
    }
  }
  return best ?? ASK_FALLBACK
}

/** The six suggested prompts from ask.md S2. */
export const ASK_SUGGESTED_PROMPTS: string[] = [
  'Which starters get hit hardest by lefties at home?',
  'Best total-bases props on tonight\u2019s slate?',
  'Any goalies running hot over their last 120 minutes?',
  'Show me bullpens fading over the last two weeks.',
  'Who has the highest XBH rate vs RHP in the L60 window?',
  'What changed for the Blue Jays lineup since April?',
]
