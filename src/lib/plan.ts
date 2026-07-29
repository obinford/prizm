// Prizm plan toggle — lightweight localStorage flag (prizm_plan) that drives
// the upgrade-wall UX only. NOT auth: identity/session is email + password.
//
// FIX 13 (2026-07-29): pricing is DEFERRED. The site launched without paid
// plans, so every feature is ungated and getPlan() is pinned to 'allaccess'.
// The plan machinery stays in place (setter, subscription, type) so
// re-introducing plans is a revert of this pin, not a rebuild. plans.ts and
// its guard test survive unreferenced under pages/pricing/ for the same
// reason. Do not reintroduce gating piecemeal — it comes back as a launch.

export type Plan = 'dashboards' | 'allaccess'

const KEY = 'prizm_plan'
const EVENT = 'prizm-plan'

export function getPlan(): Plan {
  // FIX 13: hard-pinned while pricing is deferred (see header).
  return 'allaccess'
}

export function setPlan(plan: Plan) {
  try {
    localStorage.setItem(KEY, plan)
    // notify same-tab listeners (storage event doesn't fire in-tab)
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* storage unavailable — plan stays in default */
  }
}

/** React hook-ish subscription helper for plan changes. */
export function onPlanChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}
