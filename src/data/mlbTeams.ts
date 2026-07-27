// Prizm seed data — 2026 MLB teams.

export interface MlbTeam {
  abbr: string
  name: string
  city: string
  league: 'AL' | 'NL'
  division: string
  ballpark: string
  parkFactor: number // 100 = neutral, >100 hitter friendly
  runsPerGame: number
  bullpenEra: number
  teamXwoba: number
}

export const MLB_TEAMS: MlbTeam[] = [
  { abbr: 'NYY', name: 'Yankees', city: 'New York', league: 'AL', division: 'East', ballpark: 'Yankee Stadium', parkFactor: 104, runsPerGame: 4.9, bullpenEra: 3.72, teamXwoba: 0.331 },
  { abbr: 'BOS', name: 'Red Sox', city: 'Boston', league: 'AL', division: 'East', ballpark: 'Fenway Park', parkFactor: 106, runsPerGame: 4.7, bullpenEra: 3.88, teamXwoba: 0.324 },
  { abbr: 'TOR', name: 'Blue Jays', city: 'Toronto', league: 'AL', division: 'East', ballpark: 'Rogers Centre', parkFactor: 101, runsPerGame: 4.5, bullpenEra: 3.94, teamXwoba: 0.318 },
  { abbr: 'TB', name: 'Rays', city: 'Tampa Bay', league: 'AL', division: 'East', ballpark: 'George M. Steinbrenner Field', parkFactor: 102, runsPerGame: 4.2, bullpenEra: 3.61, teamXwoba: 0.312 },
  { abbr: 'BAL', name: 'Orioles', city: 'Baltimore', league: 'AL', division: 'East', ballpark: 'Camden Yards', parkFactor: 99, runsPerGame: 4.3, bullpenEra: 4.12, teamXwoba: 0.315 },
  { abbr: 'CLE', name: 'Guardians', city: 'Cleveland', league: 'AL', division: 'Central', ballpark: 'Progressive Field', parkFactor: 97, runsPerGame: 4.1, bullpenEra: 3.42, teamXwoba: 0.309 },
  { abbr: 'DET', name: 'Tigers', city: 'Detroit', league: 'AL', division: 'Central', ballpark: 'Comerica Park', parkFactor: 96, runsPerGame: 4.4, bullpenEra: 3.55, teamXwoba: 0.317 },
  { abbr: 'KC', name: 'Royals', city: 'Kansas City', league: 'AL', division: 'Central', ballpark: 'Kauffman Stadium', parkFactor: 98, runsPerGame: 4.3, bullpenEra: 3.79, teamXwoba: 0.316 },
  { abbr: 'MIN', name: 'Twins', city: 'Minnesota', league: 'AL', division: 'Central', ballpark: 'Target Field', parkFactor: 100, runsPerGame: 4.2, bullpenEra: 4.05, teamXwoba: 0.313 },
  { abbr: 'CWS', name: 'White Sox', city: 'Chicago', league: 'AL', division: 'Central', ballpark: 'Rate Field', parkFactor: 99, runsPerGame: 3.8, bullpenEra: 4.48, teamXwoba: 0.299 },
  { abbr: 'HOU', name: 'Astros', city: 'Houston', league: 'AL', division: 'West', ballpark: 'Daikin Park', parkFactor: 100, runsPerGame: 4.4, bullpenEra: 3.66, teamXwoba: 0.319 },
  { abbr: 'TEX', name: 'Rangers', city: 'Texas', league: 'AL', division: 'West', ballpark: 'Globe Life Field', parkFactor: 98, runsPerGame: 4.2, bullpenEra: 3.91, teamXwoba: 0.314 },
  { abbr: 'SEA', name: 'Mariners', city: 'Seattle', league: 'AL', division: 'West', ballpark: 'T-Mobile Park', parkFactor: 92, runsPerGame: 4.1, bullpenEra: 3.48, teamXwoba: 0.311 },
  { abbr: 'LAA', name: 'Angels', city: 'Los Angeles', league: 'AL', division: 'West', ballpark: 'Angel Stadium', parkFactor: 98, runsPerGame: 4.0, bullpenEra: 4.36, teamXwoba: 0.307 },
  { abbr: 'ATH', name: 'Athletics', city: 'Sacramento', league: 'AL', division: 'West', ballpark: 'Sutter Health Park', parkFactor: 103, runsPerGame: 4.1, bullpenEra: 4.52, teamXwoba: 0.308 },
  { abbr: 'ATL', name: 'Braves', city: 'Atlanta', league: 'NL', division: 'East', ballpark: 'Truist Park', parkFactor: 101, runsPerGame: 4.5, bullpenEra: 3.74, teamXwoba: 0.321 },
  { abbr: 'PHI', name: 'Phillies', city: 'Philadelphia', league: 'NL', division: 'East', ballpark: 'Citizens Bank Park', parkFactor: 103, runsPerGame: 4.8, bullpenEra: 3.68, teamXwoba: 0.327 },
  { abbr: 'NYM', name: 'Mets', city: 'New York', league: 'NL', division: 'East', ballpark: 'Citi Field', parkFactor: 96, runsPerGame: 4.6, bullpenEra: 3.83, teamXwoba: 0.322 },
  { abbr: 'MIA', name: 'Marlins', city: 'Miami', league: 'NL', division: 'East', ballpark: 'loanDepot park', parkFactor: 95, runsPerGame: 3.9, bullpenEra: 4.31, teamXwoba: 0.303 },
  { abbr: 'WSH', name: 'Nationals', city: 'Washington', league: 'NL', division: 'East', ballpark: 'Nationals Park', parkFactor: 100, runsPerGame: 4.0, bullpenEra: 4.27, teamXwoba: 0.306 },
  { abbr: 'MIL', name: 'Brewers', city: 'Milwaukee', league: 'NL', division: 'Central', ballpark: 'American Family Field', parkFactor: 100, runsPerGame: 4.5, bullpenEra: 3.39, teamXwoba: 0.318 },
  { abbr: 'CHC', name: 'Cubs', city: 'Chicago', league: 'NL', division: 'Central', ballpark: 'Wrigley Field', parkFactor: 101, runsPerGame: 4.6, bullpenEra: 3.97, teamXwoba: 0.320 },
  { abbr: 'STL', name: 'Cardinals', city: 'St. Louis', league: 'NL', division: 'Central', ballpark: 'Busch Stadium', parkFactor: 96, runsPerGame: 4.0, bullpenEra: 4.08, teamXwoba: 0.308 },
  { abbr: 'CIN', name: 'Reds', city: 'Cincinnati', league: 'NL', division: 'Central', ballpark: 'Great American Ball Park', parkFactor: 107, runsPerGame: 4.4, bullpenEra: 4.15, teamXwoba: 0.317 },
  { abbr: 'PIT', name: 'Pirates', city: 'Pittsburgh', league: 'NL', division: 'Central', ballpark: 'PNC Park', parkFactor: 97, runsPerGame: 3.9, bullpenEra: 3.87, teamXwoba: 0.304 },
  { abbr: 'LAD', name: 'Dodgers', city: 'Los Angeles', league: 'NL', division: 'West', ballpark: 'Dodger Stadium', parkFactor: 99, runsPerGame: 5.1, bullpenEra: 3.58, teamXwoba: 0.335 },
  { abbr: 'SD', name: 'Padres', city: 'San Diego', league: 'NL', division: 'West', ballpark: 'Petco Park', parkFactor: 95, runsPerGame: 4.4, bullpenEra: 3.44, teamXwoba: 0.317 },
  { abbr: 'SF', name: 'Giants', city: 'San Francisco', league: 'NL', division: 'West', ballpark: 'Oracle Park', parkFactor: 93, runsPerGame: 4.1, bullpenEra: 3.76, teamXwoba: 0.310 },
  { abbr: 'ARI', name: 'Diamondbacks', city: 'Arizona', league: 'NL', division: 'West', ballpark: 'Chase Field', parkFactor: 102, runsPerGame: 4.6, bullpenEra: 4.19, teamXwoba: 0.319 },
  { abbr: 'COL', name: 'Rockies', city: 'Colorado', league: 'NL', division: 'West', ballpark: 'Coors Field', parkFactor: 115, runsPerGame: 4.3, bullpenEra: 5.02, teamXwoba: 0.311 },
]

export function getTeam(abbr: string): MlbTeam | undefined {
  return MLB_TEAMS.find((t) => t.abbr === abbr)
}

export function getTeamsByLeague(league: 'AL' | 'NL'): MlbTeam[] {
  return MLB_TEAMS.filter((t) => t.league === league)
}
