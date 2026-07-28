// Weather & ballpark factors — Step 8, Ballpark Pal park factors.
//
// One card per game: park name (from the static team seed), tonight's
// combined park + weather factors, and — where the provider has generated
// them — the per-hitter stadium-only vs weather-only split, so the user can
// see how much of tonight's number is the park and how much is the air.
//
// Honesty constraints carried from the recon (see api/weatherRouter.ts):
// - Game-level factors arrive COMBINED only; the base/adjusted split exists
//   per hitter. The card never implies a game-level base factor that the
//   feed did not send.
// - Raw conditions (temperature, humidity, wind) are not exposed by the
//   provider. The footer says so plainly; nothing here fabricates them.
// - Factors are the provider's model, cached 5 minutes server-side. The
//   slate_games.weatherJson warehouse column stays unwritten until the
//   MySQL path (DATABASE_URL) is back.

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, CloudSun } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { MLB_TEAMS } from '@/data/mlbTeams'
import { SLATE_DAY_LABEL, useSlateDay, type SlateDay } from '@/lib/slateDay'
import type { BppGameFactors, BppHitterFactors } from '../../../api/weatherRouter'

const QUERY_OPTS = { staleTime: 5 * 60_000, retry: 1 } as const

/** YYYY-MM-DD in US Eastern — the provider's date axis. */
function etDateString(day: SlateDay): string {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  if (day === 'today') return today
  // Noon UTC sidesteps DST edges when adding a calendar day.
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

// Verdict words are Prizm display cutoffs chosen for this card, not provider
// labels. HR: the feed's own per-game amounts sit on a roughly ±0.8 HR
// scale, so ±10% is a meaningful swing. Runs: ±10% of ~9 total runs ≈ a run.
function hrVerdict(percent: number): { word: string; tone: 'good' | 'bad' | 'flat' } {
  if (percent >= 10) return { word: 'HR boost', tone: 'good' }
  if (percent <= -10) return { word: 'HR suppressed', tone: 'bad' }
  return { word: 'Near neutral', tone: 'flat' }
}

function runsVerdict(percent: number): { word: string; tone: 'good' | 'bad' | 'flat' } {
  if (percent >= 10) return { word: 'Run-friendly', tone: 'good' }
  if (percent <= -10) return { word: 'Pitcher-friendly', tone: 'bad' }
  return { word: 'Near neutral', tone: 'flat' }
}

const TONE_CLASS: Record<'good' | 'bad' | 'flat', string> = {
  good: 'border-success/40 bg-success/10 text-success',
  bad: 'border-sp-amber/40 bg-sp-amber/10 text-sp-amber',
  flat: 'border-line bg-bg-2 text-text-3',
}

function fmtPercent(n: number): string {
  return `${n > 0 ? '+' : ''}${n}%`
}

function fmtAmount(n: number): string {
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}`
}

function fmtMult(n: number): string {
  return `×${n.toFixed(2)}`
}

function fmtDev(n: number): string {
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}`
}

function GameCard({ game, hitters }: { game: BppGameFactors; hitters: BppHitterFactors[] }) {
  const [open, setOpen] = useState(false)
  const homeTeam = MLB_TEAMS.find((t) => t.abbr === game.home)
  const hr = hrVerdict(game.homeRunsPercent)
  const runs = runsVerdict(game.runsPercent)

  // Largest weather-driven HR swings first — that is the split the card
  // exists to show. Rows without the stadium split yet sink to the bottom.
  const sorted = useMemo(
    () =>
      [...(hitters ?? [])].sort(
        (a, b) => (b.homeRunsWeather ?? -Infinity) - (a.homeRunsWeather ?? -Infinity),
      ),
    [hitters],
  )
  const splitAvailable = sorted.some((h) => h.homeRunsStadium != null)

  return (
    <div className="prizm-card p-5">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-[15px] font-semibold text-text-1">
          {game.away} @ {game.home}
        </span>
        <span className="data-mono text-[12px] text-text-3">{game.gameTime} ET</span>
        <span className={`data-mono rounded-sm border px-1.5 py-px text-[10px] font-bold uppercase tracking-widest ${TONE_CLASS[hr.tone]}`}>
          {hr.word}
        </span>
        <span className={`data-mono rounded-sm border px-1.5 py-px text-[10px] font-bold uppercase tracking-widest ${TONE_CLASS[runs.tone]}`}>
          {runs.word}
        </span>
      </div>
      <p className="mb-4 text-[12px] text-text-3">
        {homeTeam ? (
          <>
            {homeTeam.ballpark} · season baseline factor {homeTeam.parkFactor} (100 = neutral, season-long — tonight's factors below include weather)
          </>
        ) : (
          <>Home team {game.home} is not in the local team seed — ballpark name unavailable.</>
        )}
      </p>

      <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ['Runs', game.runsPercent, game.runsAmount, 'runs'],
            ['Home runs', game.homeRunsPercent, game.homeRunsAmount, 'HR'],
            ['2B/3B', game.doublesTriplesPercent, game.doublesTriplesAmount, '2B/3B'],
            ['Singles', game.singlesPercent, game.singlesAmount, '1B'],
          ] as const
        ).map(([label, percent, amount, unit]) => (
          <div key={label} className="rounded-md border border-line bg-bg-2 px-3 py-2">
            <p className="overline-caption text-text-3">{label}</p>
            <p className="data-mono text-[15px] font-semibold text-text-1">{fmtPercent(percent)}</p>
            <p className="data-mono text-[11px] text-text-3">
              est. {fmtAmount(amount)} {unit}
            </p>
          </div>
        ))}
      </div>
      <p className="mb-3 text-[11px] text-text-3">
        Park + weather combined — the provider does not split the game-level number.
      </p>

      {sorted.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 text-[12px] font-medium text-text-2 transition-colors hover:text-text-1"
          >
            <ChevronDown
              size={14}
              strokeWidth={1.5}
              className={`transition-transform ${open ? 'rotate-180' : ''}`}
            />
            {open ? 'Hide' : 'Show'} the park-vs-weather split for {sorted.length} hitters
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                {splitAvailable ? (
                  <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-line">
                    <table className="w-full text-[12px]">
                      <thead className="sticky top-0 bg-bg-2">
                        <tr className="text-left text-text-3">
                          <th className="px-3 py-1.5 font-medium">Hitter</th>
                          <th className="px-3 py-1.5 text-right font-medium">Stadium HR</th>
                          <th className="px-3 py-1.5 text-right font-medium">Weather HR</th>
                          <th className="px-3 py-1.5 text-right font-medium">Combined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((h) => (
                          <tr key={h.playerId} className="border-t border-line/60">
                            <td className="px-3 py-1.5 text-text-2">
                              {h.playerName} <span className="text-text-3">({h.team})</span>
                            </td>
                            {h.homeRunsStadium != null && h.homeRunsWeather != null ? (
                              <>
                                <td className="data-mono px-3 py-1.5 text-right text-text-2">
                                  {fmtMult(h.homeRunsStadium)}
                                </td>
                                <td
                                  className={`data-mono px-3 py-1.5 text-right ${
                                    h.homeRunsWeather >= 0.05
                                      ? 'text-success'
                                      : h.homeRunsWeather <= -0.05
                                        ? 'text-sp-amber'
                                        : 'text-text-3'
                                  }`}
                                >
                                  {fmtDev(h.homeRunsWeather)}
                                </td>
                                <td className="data-mono px-3 py-1.5 text-right text-text-1">
                                  {fmtMult(h.homeRuns)}
                                </td>
                              </>
                            ) : (
                              <td colSpan={3} className="px-3 py-1.5 text-right text-text-3">
                                split not generated yet — combined {fmtMult(h.homeRuns)}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-2 rounded-md border border-dashed border-line bg-bg-2/50 px-3 py-3 text-[12px] leading-relaxed text-text-3">
                    The stadium-only split has not been generated for this game yet — only combined
                    multipliers are available. Combined = stadium × weather is the provider's model;
                    nothing is estimated locally.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}

export default function WeatherTab() {
  const day = useSlateDay()
  const date = etDateString(day)
  const factorsQuery = trpc.weather.factors.useQuery({ date }, QUERY_OPTS)
  const data = factorsQuery.data

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <CloudSun size={20} strokeWidth={1.5} className="text-text-2" />
        <h3 className="font-display text-lg font-semibold text-text-1">
          Weather & ballpark factors — {SLATE_DAY_LABEL[day]}
        </h3>
        {data?.asOf && (
          <span className="data-mono text-[11px] text-text-3">
            provider data as of {new Date(data.asOf).toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })} ET · cached 5 min
          </span>
        )}
      </div>

      {factorsQuery.isLoading && (
        <div className="prizm-card p-8 text-[13px] text-text-3">Loading park factors…</div>
      )}

      {factorsQuery.isError && (
        <div className="prizm-card border-sp-amber/40 p-8">
          <p className="text-[13px] text-text-2">
            Park factors failed to load: {factorsQuery.error.message}
          </p>
        </div>
      )}

      {data && !data.configured && (
        <div className="prizm-card p-8">
          <p className="mb-2 text-[13px] font-medium text-text-1">Weather provider not configured</p>
          <p className="max-w-2xl text-[13px] leading-relaxed text-text-3">
            BALLPARKPAL_API_KEY is not set on the server, so no park factors were requested. This
            tab renders nothing rather than a plausible-looking card.
          </p>
        </div>
      )}

      {data?.configured && data.games.length === 0 && !factorsQuery.isLoading && (
        <div className="prizm-card p-8">
          <p className="max-w-2xl text-[13px] leading-relaxed text-text-3">
            No park factors published yet for {data.date}. Ballpark Pal serves today and future
            dates only, and tomorrow's factors are typically generated by late evening ET the day
            before. Nothing is backfilled.
          </p>
        </div>
      )}

      {data?.configured &&
        data.games.map((g) => (
          <GameCard key={g.gamePk} game={g} hitters={data.hittersByGame[g.gamePk] ?? []} />
        ))}

      <p className="rounded-md border border-dashed border-line bg-bg-2/50 px-3 py-3 text-[12px] leading-relaxed text-text-3">
        Factors are Ballpark Pal's model — park + weather combined at game level, with the
        stadium-only vs weather-only split per hitter where generated. Raw conditions (temperature,
        humidity, wind speed and direction) are not exposed by this provider; adding them needs a
        second weather source. Amounts are the provider's estimated per-game stat changes, not
        sportsbook lines.
      </p>
    </motion.div>
  )
}
