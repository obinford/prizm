// "Open profile" from any table row (Step 15).
//
// Handigraphs opens a player profile as a drawer over the table from a row
// action on every table; Prizm previously sent the user away to /profiler
// with no player selected. This hook resolves a row's player id against the
// hydrated pools and renders the EXISTING ProfilerDrawer over the current
// surface — the drawer, its Statcast strip and its follow wiring are
// untouched.
//
// Usage: const { openProfile, profileDrawer } = useProfileDrawer()
// Pass openProfile to DataTable's onOpenProfile (or any row action) and mount
// profileDrawer once next to the table.

import { useCallback, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import ProfilerDrawer from '@/pages/profiler/Drawer'
import { findPlayer, kindOf, posLabel } from '@/pages/profiler/derive'
import { toggleFollow } from '@/lib/follows'
import type { ProfileTarget } from '@/pages/profiler/ProfileCard'

export function useProfileDrawer() {
  const [target, setTarget] = useState<ProfileTarget | null>(null)

  const openProfile = useCallback((playerId: string) => {
    const player = findPlayer(playerId)
    // An id outside the hydrated pools (a probable the ingest doesn't cover)
    // has no profile — the action stays silent rather than opening an empty
    // drawer. Rare; the tables only list hydrated players.
    if (!player) return
    setTarget({ kind: kindOf(player), player })
  }, [])

  const profileDrawer = (
    <AnimatePresence>
      {target && (
        <ProfilerDrawer
          key={target.player.id}
          target={target}
          onClose={() => setTarget(null)}
          onFollow={() =>
            toggleFollow({
              id: target.player.id,
              sport: target.player.sport,
              name: target.player.name,
              team: target.player.team,
              role: posLabel(target.player),
            })
          }
        />
      )}
    </AnimatePresence>
  )

  return { openProfile, profileDrawer }
}
