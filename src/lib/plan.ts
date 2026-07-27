// Prizm plan toggle — lightweight localStorage flag (prizm_plan) that drives
// the upgrade-wall UX only. NOT auth: identity/session is Kimi OAuth (see
// src/hooks/useAuth.ts). Defaults to 'allaccess' during the beta.

export type Plan = 'dashboards' | 'allaccess'

const KEY = 'prizm_plan'
const EVENT = 'prizm-plan'

export function getPlan(): Plan {
  try {
    return localStorage.getItem(KEY) === 'dashboards' ? 'dashboards' : 'allaccess'
  } catch {
    return 'allaccess'
  }
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
