// User data sync — bridges the DB-backed angles + follows stores to tRPC.
// Mounted inside the authed AppShell (after LiveDataProvider hydration):
// registers the API bridges the synchronous store writers use, hydrates the
// module caches from trpc.angles.list / trpc.follows.list, and runs the
// one-time localStorage → DB migrations.

import { useEffect } from 'react'
import { trpc } from '@/providers/trpc'
import {
  migrateLegacyAngles,
  registerAnglesApi,
  syncAnglesFromDb,
} from '@/pages/angles/store'
import {
  migrateLegacyFollows,
  registerFollowsApi,
  syncFollowsFromDb,
  type FollowEntry,
} from '@/lib/follows'

export default function UserDataSync() {
  const utils = trpc.useUtils()
  const angles = trpc.angles.list.useQuery(undefined, { staleTime: 30_000, retry: false })
  const follows = trpc.follows.list.useQuery(undefined, { staleTime: 30_000, retry: false })

  useEffect(() => {
    registerAnglesApi({
      create: (input) => utils.client.angles.create.mutate(input),
      update: (id, patch) => utils.client.angles.update.mutate({ id, patch }),
      remove: (id) => utils.client.angles.delete.mutate({ id }),
      duplicateAngle: (id) => utils.client.angles.duplicate.mutate({ id }),
      invalidate: () => {
        void utils.angles.list.invalidate()
      },
    })
    registerFollowsApi({
      add: (input) => utils.client.follows.add.mutate(input),
      remove: (input) => utils.client.follows.remove.mutate(input),
      invalidate: () => {
        void utils.follows.list.invalidate()
      },
    })
    return () => {
      registerAnglesApi(null)
      registerFollowsApi(null)
    }
  }, [utils])

  useEffect(() => {
    if (!angles.data) return
    syncAnglesFromDb(angles.data as unknown[])
    void migrateLegacyAngles((input) => utils.client.angles.create.mutate(input)).then(
      (migrated) => {
        if (migrated) void utils.angles.list.invalidate()
      },
    )
  }, [angles.data, utils])

  useEffect(() => {
    if (!follows.data) return
    syncFollowsFromDb(follows.data as FollowEntry[])
    void migrateLegacyFollows((input) => utils.client.follows.add.mutate(input)).then(
      (migrated) => {
        if (migrated) void utils.follows.list.invalidate()
      },
    )
  }, [follows.data, utils])

  return null
}
