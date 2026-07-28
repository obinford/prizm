import { motion } from 'framer-motion'
import { CloudSun, MapPin, Sparkles } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { etDateString } from '@/lib/slateDay'

const QUERY_OPTS = { staleTime: 5 * 60_000, retry: 1 } as const

/**
 * Tomorrow's MLB slate — schedule facts (teams, start, venue, named
 * probables) from the keyless statsapi schedule feed, plus Ballpark Pal
 * park+weather factors where the provider has published them.
 *
 * What is deliberately NOT here: AI reads, splits matrices and betting
 * angles. Those are built from today's hydrated player/slate data, which
 * does not exist for tomorrow — the placeholder below says so instead of
 * showing yesterday's numbers under tomorrow's date.
 *
 * Probable hands are also absent: the schedule hydrate carries probable
 * names only, and borrowing today's hand data for a different pitcher would
 * be fabrication. Names appear exactly as the feed sends them.
 */
export default function TomorrowSlate() {
  const date = etDateString('tomorrow')
  const scheduleQuery = trpc.lineups.schedule.useQuery({ date }, QUERY_OPTS)
  const weatherQuery = trpc.weather.factors.useQuery({ date }, QUERY_OPTS)

  const games = scheduleQuery.data ?? []
  const weatherGames = weatherQuery.data?.games ?? []
  const weatherFor = (away: string | null, home: string | null) =>
    weatherGames.find((w) => w.away === away && w.home === home)

  return (
    <div className="space-y-4">
      {scheduleQuery.isLoading && (
        <div className="prizm-card p-8 text-[13px] text-text-3">Loading tomorrow's schedule…</div>
      )}

      {scheduleQuery.isError && (
        <div className="prizm-card border-sp-amber/40 p-8">
          <p className="text-[13px] text-text-2">
            Tomorrow's schedule failed to load: {scheduleQuery.error.message}
          </p>
        </div>
      )}

      {scheduleQuery.data && games.length === 0 && (
        <div className="prizm-card p-8 text-[13px] text-text-3">
          No MLB games scheduled for tomorrow ({date} ET).
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {games.map((g, i) => {
          const w = weatherFor(g.away, g.home)
          return (
            <motion.div
              key={g.gamePk}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="prizm-card p-5"
            >
              {/* time + venue + weather */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="data-mono rounded-sm bg-bg-2 px-2 py-1 text-[12px] font-medium text-text-1">
                  {g.startTime || '—'}
                </span>
                {g.venue && (
                  <span className="data-mono flex items-center gap-1 text-[11px] text-text-3">
                    <MapPin size={11} /> {g.venue}
                  </span>
                )}
                {w && (
                  <span
                    className="data-mono flex items-center gap-1 rounded-sm bg-sp-cyan/10 px-2 py-0.5 text-[11px] text-sp-cyan"
                    title="Ballpark Pal combined park + weather factor for home runs (integer percent vs neutral)"
                  >
                    <CloudSun size={11} /> HR {w.homeRunsPercent >= 0 ? '+' : ''}
                    {w.homeRunsPercent}%
                  </span>
                )}
              </div>

              {/* matchup + probables */}
              <div className="flex items-baseline gap-3">
                <span className="font-display text-[22px] font-bold text-text-1">{g.away ?? '—'}</span>
                <span className="data-mono text-sm text-text-3">@</span>
                <span className="font-display text-[22px] font-bold text-text-1">{g.home ?? '—'}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-[12px]">
                <span className={g.awayProbable ? 'text-text-2' : 'text-text-3'}>
                  {g.awayProbable ?? 'TBD'}
                </span>
                <span className="text-text-3">·</span>
                <span className={g.homeProbable ? 'text-text-2' : 'text-text-3'}>
                  {g.homeProbable ?? 'TBD'}
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Weather availability note — BPP publishes tomorrow's factors by
          late evening ET the day before; empty is normal earlier in the day. */}
      {weatherQuery.data?.configured && weatherGames.length === 0 && games.length > 0 && (
        <p className="text-[12px] text-text-3">
          Park + weather factors for tomorrow are published by late evening ET — none yet.
        </p>
      )}

      {/* Honest placeholder where analysis would go */}
      {games.length > 0 && (
        <div className="prizm-card border-dashed p-6">
          <p className="overline-caption mb-2 flex items-center gap-1.5 text-text-3">
            <Sparkles size={13} /> Matchup analysis
          </p>
          <p className="text-[13px] leading-relaxed text-text-3">
            AI reads, splits matrices and betting angles are built from today's hydrated player
            and odds data, which does not exist for tomorrow yet. They appear on each game's
            breakdown once this becomes today's slate — nothing is back-filled from yesterday's
            numbers.
          </p>
        </div>
      )}
    </div>
  )
}
