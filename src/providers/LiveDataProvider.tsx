// Live data bridge — loads every public dataset ONCE when the authed shell
// mounts (players incl. rolling windows, slate, props, bullpens) via tRPC,
// hydrates the src/data/* module cache (src/data/live.ts), and only then
// renders the app pages. While the initial load runs it shows a loading
// state; if the API is unreachable it shows an error state with retry.

import type { ReactNode } from 'react'
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

function ErrorState({ onRetry, busy }: { onRetry: () => void; busy: boolean }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-bg-0 px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-bg-2">
        <TriangleAlert size={22} strokeWidth={1.5} className="text-sp-amber" />
      </span>
      <h1 className="font-display text-xl font-semibold text-text-1">Live data is unreachable.</h1>
      <p className="max-w-sm text-sm leading-relaxed text-text-2">
        Prizm couldn&apos;t reach the stats API. Check your connection and try again — your research
        picks up right where it left off.
      </p>
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

  const queries = [pitchers, batters, goalies, skaters, slate, props, bullpens]
  const isLoading = queries.some((q) => q.isPending)
  const failed = queries.find((q) => q.isError)

  const allLoaded =
    pitchers.data !== undefined &&
    batters.data !== undefined &&
    goalies.data !== undefined &&
    skaters.data !== undefined &&
    slate.data !== undefined &&
    props.data !== undefined &&
    bullpens.data !== undefined

  if (isLoading && !allLoaded) return <LoadingState />

  if (failed && !allLoaded) {
    return (
      <ErrorState
        busy={queries.some((q) => q.isFetching)}
        onRetry={() => queries.forEach((q) => q.refetch())}
      />
    )
  }

  if (allLoaded) {
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
  }

  return <>{children}</>
}
