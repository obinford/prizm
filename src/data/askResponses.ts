// Prizm seed data — canned "Ask Prizm" NL answers referencing the seed data.
// askPrizm() matches a query to the best canned response by keyword scoring.

export interface AskTable {
  columns: string[]
  rows: (string | number)[][]
  /** which numeric column (index) should heat-tint vs the first row baseline */
  heatColumn?: number
}

export interface AskResponse {
  id: string
  keywords: string[]
  question: string // suggested-prompt label
  answer: string
  table?: AskTable
  sources: string[]
}

export const ASK_RESPONSES: AskResponse[] = [
  {
    id: 'ask-judge-fenway',
    keywords: ['judge', 'fenway', 'yankees', 'xbh', 'total bases', 'red sox'],
    question: 'Should I ride Aaron Judge XBH at Fenway tonight?',
    answer:
      'The angle leans red. Judge is running a .731 SLG over his L30 PA — 18% above his season baseline — and owns a career .612 SLG at Fenway Park, which plays 6% over average for right-handed pull power. The concern is Crochet: his 8.5 K line tells you books expect dominance, but his walk rate vs righties has crept up over the L60 window, which is exactly the profile Judge punishes. Over 0.5 XBH at -135 is priced fair-to-cheap against a 70% L10 hit rate.',
    table: {
      columns: ['Window', 'PA', 'AVG', 'SLG', 'XBH/G', 'Δ SLG vs season'],
      rows: [
        ['Season', '—', '.302', '.618', 0.78, '—'],
        ['L30', 30, '.341', '.731', 0.97, '+18.3%'],
        ['L60', 61, '.318', '.672', 0.86, '+8.7%'],
        ['L90', 90, '.309', '.644', 0.81, '+4.2%'],
        ['L120', 121, '.305', '.627', 0.79, '+1.5%'],
      ],
      heatColumn: 5,
    },
    sources: ['mlbPlayers.ts · aaron-judge', 'slate.ts · mlb-nyy-bos', 'props.ts · prop-1'],
  },
  {
    id: 'ask-skubal-ks',
    keywords: ['skubal', 'strikeout', 'k line', 'guardians', 'cleveland', 'detroit'],
    question: 'Is Skubal over 7.5 Ks a good number vs Cleveland?',
    answer:
      'Red flag for the over — in the good way. Skubal carries a 31.2% K rate on the season and Cleveland is whiffing 26.1% vs left-handed pitching in June, third-worst in the AL. His L120 batters-faced window shows his best xwOBA of the year (0.238), so form and matchup point the same direction. The line at 7.5 with -125 juice implies ~55%; his L20 over hit rate is 70%. That gap is your edge.',
    table: {
      columns: ['Metric', 'Season', 'L120 BF', 'Δ'],
      rows: [
        ['K%', '31.2%', '33.8%', '+8.3%'],
        ['xwOBA', '0.256', '0.238', '−7.0%'],
        ['BB%', '5.2%', '4.8%', '−7.7%'],
      ],
      heatColumn: 3,
    },
    sources: ['mlbPlayers.ts · tarik-skubal', 'props.ts · prop-13', 'news.ts · news-5'],
  },
  {
    id: 'ask-mcdavid',
    keywords: ['mcdavid', 'oilers', 'edmonton', 'points', 'calgary', 'battle of alberta'],
    question: 'McDavid points prop vs Calgary — what do the windows say?',
    answer:
      'All four windows lean red. McDavid is at 1.62 points/game on the season and his L120 MIN window is tracking 41% above that — 8 points across his last two games of ice time. Calgary concedes the 4th-most slot chances league-wide, and the Battle of Alberta games have averaged 7.2 total goals this season. Over 1.5 points at -135 is steep but supported; the plus-money ladder is the play if you want the ceiling.',
    table: {
      columns: ['Window', 'TOI', 'P/GP', 'Δ vs season'],
      rows: [
        ['Season', '—', 1.62, '—'],
        ['60 MIN', 61, 2.5, '+54%'],
        ['120 MIN', 121, 2.0, '+23%'],
        ['240 MIN', 244, 1.75, '+8%'],
      ],
      heatColumn: 3,
    },
    sources: ['nhlPlayers.ts · connor-mcdavid', 'slate.ts · nhl-edm-cgy', 'props.ts · prop-33'],
  },
  {
    id: 'ask-fade',
    keywords: ['fade', 'cold', 'avoid', 'blue', 'slump', 'ovechkin'],
    question: "Who's ice cold on tonight's slate?",
    answer:
      'Three names tint blue across every window right now. Ovechkin is the sharpest fade: 2.4 SOG/game over his L180 MIN, 35% below baseline, yet books still hang 3.5. Mark Vientos (.197 AVG over L30 PA, −20% vs season) and Adolis García (XBH rate down 24% across L60) round out the list. Cold players with stale lines are where the blue ramp pays.',
    table: {
      columns: ['Player', 'Market', 'Window', 'Δ vs baseline'],
      rows: [
        ['Alex Ovechkin', 'SOG 3.5', '180 MIN', '−35.1%'],
        ['Mark Vientos', 'Hits 1.5', 'L30 PA', '−20.2%'],
        ['Adolis García', 'XBH 0.5', 'L60 PA', '−24.0%'],
      ],
      heatColumn: 3,
    },
    sources: ['nhlPlayers.ts · alex-ovechkin', 'mlbPlayers.ts · mark-vientos', 'mlbPlayers.ts · adolis-garcia'],
  },
  {
    id: 'ask-heat-sutter',
    keywords: ['weather', 'heat', 'sutter', 'athletics', 'sacramento', 'raleigh', 'mariners'],
    question: 'Does the Sacramento heat matter for the Mariners game?',
    answer:
      'Yes — it is the strongest weather angle on the slate. Sutter Health Park already plays +3% for homers, and 96°F at first pitch adds roughly 6% carry. XBH and total-bases overs have hit at 61% in 95°F+ games this season. Cal Raleigh is the cleanest way in: 2.24 TB/game on the season, 2.81 over his L30 PA (+25%), and his over 1.5 total bases is plus money at +105.',
    table: {
      columns: ['Player', 'Market', 'Line', 'L10 hit rate', 'Price'],
      rows: [
        ['Cal Raleigh', 'Total Bases', 1.5, '70%', '+105'],
        ['Julio Rodríguez', 'Total Bases', 1.5, '60%', '−105'],
        ['Hunter Goodman', 'XBH', 0.5, '55%', '−110'],
      ],
    },
    sources: ['news.ts · news-3', 'props.ts · prop-9', 'mlbTeams.ts · ATH'],
  },
  {
    id: 'ask-goalie',
    keywords: ['goalie', 'saves', 'wolf', 'shesterkin', 'sv%', 'gsax', 'vasilevskiy'],
    question: 'Which goalie saves prop is the best value tonight?',
    answer:
      "Dustin Wolf over 30.5 saves is the EdgeCenter's top goalie flag. Edmonton brings league-best rush volume (33.8 SOG on the road), Wolf's L240 MIN shows a .931 SV% — 19 points above his season mark — and the volume projection (34+ shots) clears the line even with regression baked in. Shesterkin 28.5 at even juice is the conservative alternative; his .941 SV% vs New Jersey this season is the best splits sample on the board.",
    table: {
      columns: ['Goalie', 'Line', 'L240 SV%', 'Season SV%', 'Δ'],
      rows: [
        ['Dustin Wolf', '30.5 saves', '.931', '.912', '+2.1%'],
        ['Igor Shesterkin', '28.5 saves', '.928', '.914', '+1.5%'],
        ['Jake Oettinger', '27.5 saves', '.909', '.913', '−0.4%'],
      ],
      heatColumn: 4,
    },
    sources: ['nhlPlayers.ts · dustin-wolf', 'props.ts · prop-29', 'news.ts · news-8'],
  },
]

export const ASK_FALLBACK: AskResponse = {
  id: 'ask-fallback',
  keywords: [],
  question: '',
  answer:
    "Here's how I'd frame that: every answer in Prizm starts from the same three lenses — season baseline, rolling windows (L30–L120 PA in MLB, 60–240 MIN in NHL), and tonight's price. Try asking about a specific player on tonight's slate, a market like XBH or SOG, or a matchup like Yankees–Red Sox, and I'll pull the exact split tables with the red/blue deltas.",
  sources: ['slate.ts', 'props.ts'],
}

export const SUGGESTED_PROMPTS: string[] = ASK_RESPONSES.map((r) => r.question)

/** Score-based matcher over the canned responses. */
export function askPrizm(query: string): AskResponse {
  const q = query.toLowerCase()
  let best: AskResponse | null = null
  let bestScore = 0
  for (const r of ASK_RESPONSES) {
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

// ---------------------------------------------------------------------------
// Ask Prizm query meter (localStorage prizm_queries) — unlimited on allaccess
// ---------------------------------------------------------------------------

const QUERIES_KEY = 'prizm_queries'
export const FREE_DAILY_QUERIES = 5

export function getQueryCount(): number {
  try {
    const raw = localStorage.getItem(QUERIES_KEY)
    if (!raw) return 0
    const parsed = JSON.parse(raw) as { date: string; count: number }
    const today = new Date().toDateString()
    return parsed.date === today ? parsed.count : 0
  } catch {
    return 0
  }
}

export function incrementQueryCount(): number {
  const today = new Date().toDateString()
  const count = getQueryCount() + 1
  localStorage.setItem(QUERIES_KEY, JSON.stringify({ date: today, count }))
  return count
}

export function queriesRemaining(plan: 'dashboards' | 'allaccess'): number {
  if (plan === 'allaccess') return Infinity
  return Math.max(0, FREE_DAILY_QUERIES - getQueryCount())
}
