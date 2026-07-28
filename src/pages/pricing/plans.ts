// Pricing plan definitions — single source for the pricing page plan cards
// (PlanCard.tsx) and the feature comparison table (ComparisonTable.tsx).
// Prices mirror the landing-page pricing preview (src/pages/home/sections2.tsx).

export interface Plan {
  id: 'dashboards' | 'allaccess'
  name: string
  tagline: string
  /** USD per month, billed monthly */
  monthly: number
  /** USD per month, billed annually */
  annual: number
  features: string[]
}

export const PLANS: Plan[] = [
  {
    id: 'dashboards',
    name: 'Dashboards Only',
    tagline: 'The split tables and hit-rate scanner, nothing you won’t open.',
    monthly: 12.99,
    annual: 9.99,
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
    monthly: 24.99,
    annual: 19.99,
    features: [
      'Everything in Dashboards',
      'Hit Rates — full slate',
      'EdgeCenter full board',
      'My Angles + sharing',
    ],
  },
]

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
