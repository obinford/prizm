// Prizm seed data — news feed items (player/team blurbs for Profiler & dashboards).

export interface NewsItem {
  id: string
  sport: 'mlb' | 'nhl'
  playerId?: string
  player?: string
  team?: string
  tag: 'Injury' | 'Lineup' | 'Form' | 'Weather' | 'Transaction' | 'Matchup'
  title: string
  body: string
  time: string // relative, e.g. '2h ago'
}

export const NEWS: NewsItem[] = [
  {
    id: 'news-1', sport: 'mlb', playerId: 'aaron-judge', player: 'Aaron Judge', team: 'NYY', tag: 'Form',
    title: "Judge stays scorching at Fenway — 6 XBH in his L30 PA vs BOS pitching",
    body: "Judge is slashing .341/.468/.731 over his last 30 plate appearances and owns a .612 career SLG at Fenway Park. Tonight he gets Garrett Crochet, whose BB% has crept up over his L60 batters faced.",
    time: '1h ago',
  },
  {
    id: 'news-2', sport: 'mlb', playerId: 'garrett-crochet', player: 'Garrett Crochet', team: 'BOS', tag: 'Matchup',
    title: "Crochet's K% dips 4.2 points vs right-heavy lineups over L60 BF",
    body: "The lefty's whiff rate on the sweeper is down vs RHB in the last two turns. The Yankees roll out seven righties tonight — the 8.5 K line is the highest he has carried this season.",
    time: '2h ago',
  },
  {
    id: 'news-3', sport: 'mlb', team: 'ATH', tag: 'Weather',
    title: "Heat at Sutter Health Park: 96°F at first pitch, ball carrying 6% farther",
    body: "Sutter Health has played 3% over league average for homers this season and tonight's heat boosts carry again. Total bases and XBH overs have hit at 61% in games 95°F+ this season.",
    time: '3h ago',
  },
  {
    id: 'news-4', sport: 'mlb', playerId: 'cal-raleigh', player: 'Cal Raleigh', team: 'SEA', tag: 'Form',
    title: "Raleigh's barrel rate doubles over L30 PA window",
    body: "Big Dumper is 9-for-28 with 5 homers across his last 30 plate appearances. His season TB/game sits at 2.24 — the L30 window is tracking 2.81, a +25% delta that flags red across the split table.",
    time: '4h ago',
  },
  {
    id: 'news-5', sport: 'mlb', playerId: 'tarik-skubal', player: 'Tarik Skubal', team: 'DET', tag: 'Matchup',
    title: "Skubal faces a Guardians lineup whiffing 26.1% vs LHP in June",
    body: "Cleveland's K rate vs lefties has climbed for three straight weeks. Skubal's L120 BF shows a 0.238 xwOBA — his best window of the season — with the K line parked at 7.5.",
    time: '5h ago',
  },
  {
    id: 'news-6', sport: 'mlb', playerId: 'juan-soto', player: 'Juan Soto', team: 'NYM', tag: 'Lineup',
    title: "Soto moves back to the two-hole; Lindor dropped to fifth",
    body: "The Mets shuffle the top of the order ahead of the Nationals series. Soto has a .408 OBP on the season and sees 4.31 pitches per PA — volume matters for total bases ladders.",
    time: '6h ago',
  },
  {
    id: 'news-7', sport: 'nhl', playerId: 'connor-mcdavid', player: 'Connor McDavid', team: 'EDM', tag: 'Form',
    title: "McDavid: 8 points across his L120 MIN heading into Battle of Alberta",
    body: "McDavid's points/game is tracking 41% above his season baseline over the last two games of ice time. Calgary has allowed the 4th-most slot chances in the league over that span.",
    time: '1h ago',
  },
  {
    id: 'news-8', sport: 'nhl', playerId: 'dustin-wolf', player: 'Dustin Wolf', team: 'CGY', tag: 'Matchup',
    title: "Wolf projected for 34+ shots as Edmonton brings league-best rush volume",
    body: "The Oilers average 33.8 SOG on the road and Wolf's saves line is set at 30.5. His L240 MIN shows a .931 SV% — well above his .912 season mark.",
    time: '2h ago',
  },
  {
    id: 'news-9', sport: 'nhl', playerId: 'igor-shesterkin', player: 'Igor Shesterkin', team: 'NYR', tag: 'Injury',
    title: "Shesterkin confirmed starter after maintenance day Monday",
    body: "No concern for the Hudson rivalry. Igor owns a .941 SV% in 240 minutes vs New Jersey this season with +6.8 GSAx in the sample.",
    time: '4h ago',
  },
  {
    id: 'news-10', sport: 'nhl', playerId: 'alex-ovechkin', player: 'Alex Ovechkin', team: 'WSH', tag: 'Form',
    title: "Ovechkin shot volume drying up — 2.4 SOG/game over L180 MIN",
    body: "The captain's SOG/game is 35% below his season baseline across the last three games. Books still hang 3.5 with -110 juice on the over — a candidate fade flag.",
    time: '7h ago',
  },
  {
    id: 'news-11', sport: 'mlb', playerId: 'yoshinobu-yamamoto', player: 'Yoshinobu Yamamoto', team: 'LAD', tag: 'Form',
    title: "Yamamoto's splitter whiff rate back to April levels",
    body: "Over his L120 BF, Yamamoto holds hitters to a .251 xwOBA with a K% up 9% vs his season rate. Oracle Park suppresses righty power — the under 6.5 K conversation starts with the Giants' contact-first approach.",
    time: '8h ago',
  },
  {
    id: 'news-12', sport: 'nhl', playerId: 'nathan-mackinnon', player: 'Nathan MacKinnon', team: 'COL', tag: 'Matchup',
    title: "MacKinnon vs Dallas: 12 SOG in two meetings this season",
    body: "MacKinnon has cleared 4.5 SOG in 7 of his last 10 and Dallas concedes the 2nd-most shots to opposing top lines. Edge score flags the over at -120.",
    time: '9h ago',
  },
]

export function getNews(filters: { sport?: 'mlb' | 'nhl'; playerId?: string; team?: string } = {}): NewsItem[] {
  return NEWS.filter(
    (n) =>
      (!filters.sport || n.sport === filters.sport) &&
      (!filters.playerId || n.playerId === filters.playerId) &&
      (!filters.team || n.team === filters.team),
  )
}

export function getPlayerNews(playerId: string): NewsItem[] {
  return NEWS.filter((n) => n.playerId === playerId)
}
