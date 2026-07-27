// Pricing plan card — price with rolling digits, feature list, trial CTA.
// The All Access card (highlight) gets the spectrum border + BEST VALUE badge.

import { Link } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import DigitRoll from '@/pages/pricing/DigitRoll'
import Magnetic from '@/pages/pricing/Magnetic'
import type { Plan } from '@/pages/pricing/plans'

interface Props {
  plan: Plan
  annual: boolean
  highlight: boolean
}

export default function PlanCard({ plan, annual, highlight }: Props) {
  const price = annual ? plan.annual : plan.monthly

  return (
    <div
      className="relative flex h-full flex-col rounded-xl p-7"
      style={{
        border: highlight ? '1.5px solid transparent' : '1px solid var(--line)',
        background: highlight
          ? 'linear-gradient(var(--bg-1), var(--bg-1)) padding-box, var(--gradient-spectrum) border-box'
          : 'var(--bg-1)',
        boxShadow: highlight ? '0 0 32px rgba(99,102,241,0.25)' : undefined,
      }}
    >
      {highlight && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-sm px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] text-white"
          style={{ background: 'var(--gradient-spectrum)' }}
        >
          BEST VALUE
        </span>
      )}

      <h3 className="font-display text-xl font-semibold text-text-1">{plan.name}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-text-3">{plan.tagline}</p>

      <p className="mt-5 flex items-baseline gap-2">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={annual ? 'annual' : 'monthly'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="inline-block"
          >
            <DigitRoll
              value={`$${price.toFixed(2)}`}
              className="text-4xl font-bold text-text-1"
            />
          </motion.span>
        </AnimatePresence>
        <span className="text-sm text-text-3">/mo{annual ? ' · billed annually' : ''}</span>
      </p>

      <ul className="mt-6 flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-text-2">
            <Check size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-sp-cyan" />
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-7">
        <Magnetic>
          <Link
            to="/register"
            className={`block rounded-md px-5 py-3 text-center text-sm font-semibold transition-all duration-200 active:scale-[0.97] ${
              highlight
                ? 'bg-sp-indigo text-white hover:brightness-110 hover:shadow-cta-glow'
                : 'border border-line bg-bg-2 text-text-1 hover:bg-bg-3'
            }`}
          >
            Start free trial
          </Link>
        </Magnetic>
        <p className="data-mono mt-3 text-center text-[11px] text-text-3">
          7 days free · $0 today
        </p>
      </div>
    </div>
  )
}
