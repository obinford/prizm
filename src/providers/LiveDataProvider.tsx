// Live data bridge — loads every public dataset ONCE when the authed shell
// mounts (players incl. rolling windows, slate, props, bullpens) via tRPC,
// hydrates the src/data/* module cache (src/data/live.ts), and only then
// renders the app pages. While the initial load runs it shows a loading
// state; if the API is unreachable it shows an error state with retry.

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { hydrateLiveData, type BullpenStats } from '@/data/live'
import type { Batter, Pitcher } from '@/data/mlbPlayers'
import type { Goalie, Skater } from '@/data/nhlPlayers'
import type { PropLine } from '@/data/props'
import type { SlateGame } from '@/data/slate'

const QUERY_OPTS = {
  staleTime: 5 * 60_000,
  retry: 1,
} as const

/**
 * How long the initial load may run before we stop trusting it.
 *
 * A request that never settles leaves TanStack Query in `isPending` forever, so
 * a pure status check can spin indefinitely — which is exactly what happened
 * when the API module crashed at import and the dev server held the connection
 * open instead of returning. The watchdog converts "never answered" into the
 * same visible failure as "answered with an error".
 */
const LOAD_TIMEOUT_MS = 12_000

function LoadingState() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-bg-0">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span
          className="absolute inset-0 rounded-full opacity-40 blur-md"
          style={{ background: 'var(--gradient-spectrum)' }}
        />
        <img src="/favicon.svg" alt="" className="relative h-10 w-10" />
      </div>
      <div className="flex items-center gap-2 text-sm text-text-2">
        <Loader2 size={15} className="animate-spin text-sp-indigo" />
        Loading live MLB/NHL data…
      </div>
      <p className="data-mono text-[11px] text-text-3">players · windows · slate · props · bullpens</p>
    </div>
  )
}

function ErrorState({
  onRetry,
  busy,
  detail,
  timedOut,
}: {
  onRetry: () => void
  busy: boolean
  detail?: string
  timedOut?: boolean
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-bg-0 px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-bg-2">
        <TriangleAlert size={22} strokeWidth={1.5} className="text-sp-amber" />
      </span>
      <h1 className="font-display text-xl font-semibold text-text-1">Live data is unreachable.</h1>
      <p className="max-w-sm text-sm leading-relaxed text-text-2">
        {timedOut
          ? 'The stats API did not respond. Nothing below would be trustworthy, so Prizm is showing you this instead of an empty dashboard.'
          : 'Prizm couldn’t reach the stats API. Check your connection and try again — your research picks up right where it left off.'}
      </p>
      {detail && (
        <p className="data-mono max-w-md text-[11px] leading-relaxed text-text-3">{detail}</p>
      )}
      <button
        type="button"
        onClick={onRetry}
        disabled={busy}
        className="mt-2 flex items-center gap-2 rounded-md bg-sp-indigo px-5 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-70"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
        Retry
      </button>
    </div>
  )
}

export default function LiveDataProvider({ children }: { children: ReactNode }) {
  const pitchers = trpc.players.pitchers.useQuery(undefined, QUERY_OPTS)
  const batters = trpc.players.batters.useQuery(undefined, QUERY_OPTS)
  const goalies = trpc.players.goalies.useQuery(undefined, QUERY_OPTS)
  const skaters = trpc.players.skaters.useQuery(undefined, QUERY_OPTS)
  const slate = trpc.slate.today.useQuery(undefined, QUERY_OPTS)
  const props = trpc.props.list.useQuery(undefined, QUERY_OPTS)
  const bullpens = trpc.slate.bullpens.useQuery(undefined, QUERY_OPTS)

  const named = [
    ['players.pitchers', pitchers],
    ['players.batters', batters],
    ['players.goalies', goalies],
    ['players.skaters', skaters],
    ['slate.today', slate],
    ['props.list', props],
    ['slate.bullpens', bullpens],
  ] as const
  const queries = named.map(([, q]) => q)

  const allLoaded = queries.every((q) => q.data !== undefined)
  const errored = named.filter(([, q]) => q.isError)
  const isPending = queries.some((q) => q.isPending)
  const isFetching = queries.some((q) => q.isFetching)

  // Watchdog. Reset whenever a fetch cycle starts so Retry gets a fresh window.
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    if (allLoaded || !isPending) return
    setTimedOut(false)
    const t = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [allLoaded, isPending])

  const retry = () => {
    setTimedOut(false)
    queries.forEach((q) => void q.refetch())
  }

  // ERROR CHECK COMES FIRST — deliberately.
  //
  // The previous order was `if (isLoading && !allLoaded) return <LoadingState/>`
  // ahead of the error branch, so a single still-pending query masked real
  // failures in the other six and the designed error state never rendered. A
  // known failure must never be hidden behind an unknown: if any query has
  // errored, or the watchdog has fired, say so.
  if (!allLoaded && (errored.length > 0 || timedOut)) {
    const detail =
      errored.length > 0
        ? `Failed: ${errored.map(([name]) => name).join(', ')}${
            errored[0]?.[1].error ? ` — ${String(errored[0][1].error.message).slice(0, 140)}` : ''
          }`
        : `No response after ${Math.round(LOAD_TIMEOUT_MS / 1000)}s.`
    return <ErrorState busy={isFetching} onRetry={retry} detail={detail} timedOut={timedOut} />
  }

  if (!allLoaded) return <LoadingState />

  // Idempotent in-place hydration of the src/data/* module arrays. Runs
  // synchronously during render so children never observe an empty cache.
  hydrateLiveData({
    pitchers: pitchers.data as Pitcher[],
    batters: batters.data as Batter[],
    goalies: goalies.data as Goalie[],
    skaters: skaters.data as Skater[],
    slate: slate.data as SlateGame[],
    props: props.data as PropLine[],
    bullpens: bullpens.data as BullpenStats[],
  })

  return <>{children}</>
}
