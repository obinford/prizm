// Pricing plan definitions — THE single source of truth for plan prices.
// Every surface that mentions a price imports from here: the pricing page
// (PlanCard, ComparisonTable, Pricing savings badge), the checkout form
// (Register), the homepage preview (home/sections2), Terms, FAQ, and the
// in-app upgrade wall (hit-rates/UpgradeWall). A price literal anywhere else
// is a future contradiction — plans.test.ts fails the build if one appears.
//
// Field names carry the unit because this bug already happened once:
// `annual: 9.99` read as a monthly-equivalent here while Register read
// `annual: 149.99` as a yearly total, so checkout charged 25% more than the
// pricing page advertised. monthlyPrice is per month; annualTotal is the
// WHOLE-YEAR charge; the monthly-equivalent is derived, never stored.
//
// The numbers themselves are a business decision (Oakley). Change them HERE
// and only here — every page follows.

export interface Plan {
  id: 'dashboards' | 'allaccess'
  name: string
  tagline: string
  /** USD per month, billed monthly. */
  monthlyPrice: number
  /** USD per year, billed annually — the total charge, NOT a monthly rate. */
  annualTotal: number
  features: string[]
}

export const PLANS: Plan[] = [
  {
    id: 'dashboards',
    name: 'Dashboards Only',
    tagline: 'The split tables and hit-rate scanner, nothing you won’t open.',
    monthlyPrice: 12.99,
    annualTotal: 119.88,
    features: [
      'MLB + NHL split tables',
      'Hit Rates scanner',
      'Profiler & GameCenter',
      'Saved views & filters',
    ],
  },
  {
    id: 'allaccess',
    name: 'All Access',
    tagline: 'Every instrument — splits, edges, angles, and the Profiler.',
    monthlyPrice: 24.99,
    annualTotal: 239.88,
    features: [
      'Everything in Dashboards',
      'Hit Rates — full slate',
      'EdgeCenter full board',
      'My Angles + sharing',
    ],
  },
]

export type PlanId = Plan['id']

export function planById(id: PlanId): Plan {
  const p = PLANS.find((pl) => pl.id === id)
  if (!p) throw new Error(`unknown plan: ${id}`)
  return p
}

/** USD display: fmtUsd(12.99) → "$12.99". */
export const fmtUsd = (n: number): string => `$${n.toFixed(2)}`

/** Monthly-equivalent of the annual price, for "/mo · billed annually"
 * display. Derived from annualTotal — never stored, so the two can never
 * disagree. */
export const monthlyEquivalent = (p: Plan): number => p.annualTotal / 12

/** Whole-percent saving of annual billing vs twelve monthly payments.
 * Computed everywhere it is shown; a hardcoded discount badge is how the
 * "−20%" claim drifted out of true. */
export const savingsPct = (p: Plan): number =>
  Math.round((1 - p.annualTotal / (p.monthlyPrice * 12)) * 100)

/** Cheapest monthly price across plans — for "from $X/mo" marketing lines. */
export const fromMonthlyPrice = (): number => Math.min(...PLANS.map((p) => p.monthlyPrice))

/** Most conservative (smallest) annual saving across plans — safe for a
 * single site-wide discount badge. */
export const minSavingsPct = (): number => Math.min(...PLANS.map(savingsPct))

export interface ComparisonRow {
  label: string
  dashboards: boolean
  allaccess: boolean
  /** Optional note rendered as a superscript-style suffix. */
  note?: string
}

/** Feature-by-feature comparison — only surfaces that exist in the app. */
export const COMPARISON_ROWS: ComparisonRow[] = [
  { label: 'MLB split tables (L30–L120 PA windows)', dashboards: true, allaccess: true },
  { label: 'NHL split tables (60–240 min windows)', dashboards: true, allaccess: true },
  { label: 'Hit Rates scanner with price alerts', dashboards: true, allaccess: true },
  { label: 'Profiler — game logs, splits, news', dashboards: true, allaccess: true },
  { label: 'GameCenter slate breakdowns', dashboards: true, allaccess: true },
  { label: 'Saved views & filters', dashboards: true, allaccess: true },
  { label: 'My Angles + sharing', dashboards: false, allaccess: true },
  { label: 'EdgeCenter full board', dashboards: false, allaccess: true },
  { label: 'Hit Rates — full slate, line + edge filters', dashboards: false, allaccess: true },
]
