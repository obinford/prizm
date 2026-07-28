// Quick Alerts — Step 11.1. Schedule-derived situation cards from
// trpc.brief.quickAlerts (statsapi schedule range + venue coordinates +
// Ballpark Pal HR factor). Every group renders its own honest empty state
// naming why it produced nothing; a blank section is never acceptable.

import { motion } from 'framer-motion'
import { Bell, CalendarClock, Plane, CloudSun } from 'lucide-react'
import { trpc } from '@/providers/trpc'

const QUERY_OPTS = { staleTime: 5 * 60_000, retry: 1 } as const

function Group({
  icon,
  title,
  children,
  empty,
  isEmpty,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  empty: string
  isEmpty: boolean
}) {
  return (
    <div>
      <p className="overline-caption mb-2 flex items-center gap-1.5 text-text-3">
        {icon}
        {title}
      </p>
      {isEmpty ? (
        <p className="rounded-md border border-dashed border-line bg-bg-2/50 px-3 py-3 text-[12px] leading-relaxed text-text-3">
          {empty}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">{children}</div>
      )}
    </div>
  )
}

function AlertChip({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="data-mono rounded-md border border-line bg-bg-2 px-3 py-2 text-[12px] text-text-1"
    >
      {children}
    </span>
  )
}

export default function QuickAlerts() {
  const alertsQuery = trpc.brief.quickAlerts.useQuery(undefined, QUERY_OPTS)
  const data = alertsQuery.data

  if (alertsQuery.isLoading) {
    return (
      <section className="mb-10">
        <p className="overline-caption mb-3 flex items-center gap-1.5 text-text-3">
          <Bell size={13} /> Quick alerts
        </p>
        <div className="prizm-card p-5 text-[13px] text-text-3">Checking the schedule…</div>
      </section>
    )
  }

  if (alertsQuery.isError || !data) {
    return (
      <section className="mb-10">
        <p className="overline-caption mb-3 flex items-center gap-1.5 text-text-3">
          <Bell size={13} /> Quick alerts
        </p>
        <p className="rounded-md border border-dashed border-line bg-bg-2/50 px-3 py-3 text-[12px] text-text-3">
          Quick alerts failed to load{alertsQuery.error ? ` — ${alertsQuery.error.message}` : ''}.
          The schedule feed may be unreachable; nothing is substituted.
        </p>
      </section>
    )
  }

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="mb-10 space-y-4"
    >
      <p className="overline-caption flex items-center gap-1.5 text-text-3">
        <Bell size={13} /> Quick alerts
        <span className="data-mono normal-case tracking-normal">
          · {data.range.gamesReturned} games over {data.range.dateEntries} dates
          {data.range.complete ? ' (range verified complete)' : ' (RANGE INCOMPLETE — counts may understate)'}
        </span>
      </p>

      <Group
        icon={<CalendarClock size={13} />}
        title="No off day in 7+ days"
        isEmpty={data.noOffDay.length === 0}
        empty="Every team on tonight's slate has had an off day inside the last week."
      >
        {data.noOffDay.map((a) => (
          <AlertChip key={a.team} title={`${a.team} has played every day since ${a.since}`}>
            {a.team} — {a.days} straight days
          </AlertChip>
        ))}
      </Group>

      <Group
        icon={<Plane size={13} />}
        title="Travel"
        isEmpty={data.travel.length === 0}
        empty={
          data.travelSkippedNoCoords > 0
            ? `No qualifying travel moves tonight (${data.travelSkippedNoCoords} venue change${data.travelSkippedNoCoords === 1 ? '' : 's'} skipped — the feed returned no coordinates; never guessed).`
            : 'No team changed venue by 250+ miles for tonight.'
        }
      >
        {data.travel.map((t) => (
          <AlertChip key={t.team} title={`${t.fromVenue} → ${t.toVenue}`}>
            {t.team}: {t.direction} · {t.miles.toLocaleString()} mi
          </AlertChip>
        ))}
      </Group>

      <Group
        icon={<CloudSun size={13} />}
        title="Weather HR verdict"
        isEmpty={data.weatherHr.length === 0}
        empty={
          data.weatherHrNote ??
          "No park's HR factor clears ±10% tonight — weather is roughly neutral for home runs."
        }
      >
        {data.weatherHr.map((w) => (
          <AlertChip key={w.gamePk} title="Ballpark Pal game-level HR factor, park + weather combined">
            {w.matchup} — {w.verdict === 'good' ? 'Good' : 'Poor'} HR factor (
            {w.homeRunsPercent > 0 ? '+' : ''}
            {w.homeRunsPercent}%)
          </AlertChip>
        ))}
      </Group>
    </motion.section>
  )
}
