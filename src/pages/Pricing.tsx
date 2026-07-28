import { useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Gem } from 'lucide-react'
import ComparisonTable from '@/pages/pricing/ComparisonTable'
import { PLANS } from '@/pages/pricing/plans'
import PlanCard from '@/pages/pricing/PlanCard'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

const MINI_FAQS = [
  {
    q: 'How does the 7-day trial work?',
    a: 'Card required up front, $0 charged today. Full access to your plan for 7 days — you are billed only if you stay past day 7. Cancel in two clicks from your account page.',
  },
  {
    q: 'Can I switch plans later?',
    a: 'Anytime. Upgrades are prorated instantly; downgrades take effect at the end of your billing period.',
  },
  {
    q: 'Is Prizm a sportsbook?',
    a: 'No. We never take bets or hold funds. Prizm is a research tool — prices shown are for context only. 21+ only.',
  },
]

export default function Pricing() {
  const [annual, setAnnual] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const monthlyTotal = PLANS.reduce((s, p) => s + p.monthlyPrice, 0)
  const annualTotal = PLANS.reduce((s, p) => s + p.annualTotal, 0)
  const savings = Math.round((1 - annualTotal / (monthlyTotal * 12)) * 100)

  return (
    <div className="bg-bg-0">
      {/* S1 — Header */}
      <section className="relative overflow-hidden px-6 pb-12 pt-20 max-lg:pt-14">
        {/* Subtle indigo glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-72 w-[720px] -translate-x-1/2 rounded-full opacity-30 blur-[100px]"
          style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.5), transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-[760px] text-center">
          <div className="inline-block">
            <span className="overline-caption text-sp-indigo">Pricing</span>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="mt-2 h-px origin-left opacity-60"
              style={{ background: 'var(--gradient-spectrum)' }}
            />
          </div>
          <h1
            className="font-display mt-5 font-bold text-text-1"
            style={{ fontSize: 'clamp(34px, 5vw, 52px)', lineHeight: 1.05, letterSpacing: '-0.02em' }}
          >
            <motion.span initial="hidden" animate="visible" transition={{ staggerChildren: 0.08 }}>
              {['Simple', 'pricing,', 'sharp', 'edges.'].map((w, i) => (
                <motion.span
                  key={w}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
                  }}
                  className={`mr-3 inline-block last:mr-0 ${i === 3 ? 'text-spectrum' : ''}`}
                >
                  {w}
                </motion.span>
              ))}
            </motion.span>
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3, ease: EASE }}
            className="mx-auto mt-4 max-w-xl text-lg leading-[1.65] text-text-2"
          >
            Start with a 7-day free trial. $0 today — your card is only charged if you stay.
          </motion.p>

          {/* S2 — Billing cadence toggle */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4, ease: EASE }}
            className="mt-8 flex items-center justify-center gap-3"
          >
            <div className="flex items-center rounded-full border border-line bg-bg-2 p-0.5">
              {(['Monthly', 'Annual'] as const).map((label) => {
                const isAnnual = label === 'Annual'
                const active = annual === isAnnual
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setAnnual(isAnnual)}
                    className={`relative flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      active ? 'text-text-1' : 'text-text-3 hover:text-text-2'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="cadence-pill"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        className="absolute inset-0 rounded-full bg-bg-3"
                      />
                    )}
                    <span className="relative">{label}</span>
                    {isAnnual && (
                      <span className="data-mono relative rounded-sm bg-sp-amber/15 px-1.5 py-0.5 text-[10px] font-semibold text-sp-amber">
                        save {savings}%
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* S3 — Plan cards */}
      <section className="px-6">
        <div className="mx-auto grid max-w-[880px] items-start gap-6 md:grid-cols-2">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45 + i * 0.12, ease: EASE }}
            >
              <PlanCard plan={plan} annual={annual} highlight={plan.id === 'allaccess'} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* S4 — Trial reassurance strip */}
      <section className="px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mx-auto flex max-w-[880px] flex-col items-center justify-between gap-4 rounded-md border border-line bg-bg-2 px-6 py-4 sm:flex-row"
        >
          <div className="flex flex-wrap items-center justify-center gap-2">
            {['7 days free', '$0 today', 'Cancel in two clicks', 'Keep your saved angles'].map((chip) => (
              <span
                key={chip}
                className="data-mono rounded-sm border border-line bg-bg-1 px-2.5 py-1 text-[12px] text-text-2"
              >
                {chip}
              </span>
            ))}
          </div>
          <p className="text-center text-[13px] text-text-3 sm:text-right">
            Every plan starts with the trial. No charge until day 8.
          </p>
        </motion.div>
      </section>

      {/* S5 — Comparison table */}
      <section className="px-6 pb-4">
        <div className="mx-auto max-w-[880px]">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="font-display mb-6 text-center text-2xl font-semibold tracking-[-0.01em] text-text-1"
          >
            Compare <span className="text-spectrum">plans.</span>
          </motion.h2>
          <ComparisonTable />
        </div>
      </section>

      {/* S6 — Mini FAQ */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-[880px]">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="font-display mb-6 text-center text-2xl font-semibold tracking-[-0.01em] text-text-1"
          >
            Before you ask.
          </motion.h2>
          <div className="space-y-3">
            {MINI_FAQS.map((f, i) => {
              const open = openFaq === i
              return (
                <motion.div
                  key={f.q}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.4, delay: i * 0.08, ease: EASE }}
                  className="prizm-card"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
                  >
                    <span className="text-[15px] font-semibold text-text-1">{f.q}</span>
                    <motion.span
                      animate={{ rotate: open ? 180 : 0 }}
                      transition={{ duration: 0.25 }}
                      className="shrink-0 text-text-3"
                    >
                      <ChevronDown size={18} strokeWidth={1.5} />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <p className="px-6 pb-5 text-[15px] leading-[1.65] text-text-2">{f.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
          <p className="mt-6 text-center text-sm text-text-3">
            More questions?{' '}
            <Link to="/faq" className="text-sp-indigo hover:brightness-125">
              Visit the full FAQ
            </Link>
          </p>
        </div>
      </section>

      {/* S7 — Final band */}
      <section className="px-6 pb-[120px] max-lg:pb-[72px]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="prizm-card relative mx-auto max-w-[880px] overflow-hidden px-6 py-16 text-center"
        >
          {/* 4% opacity prism gem watermark */}
          <Gem
            aria-hidden
            size={220}
            strokeWidth={1}
            className="pointer-events-none absolute -right-10 -top-10 rotate-12 text-text-1 opacity-[0.04]"
          />
          <h2 className="font-display relative text-2xl font-semibold tracking-[-0.01em] text-text-1 md:text-3xl">
            Your first week is on <span className="text-spectrum">us.</span>
          </h2>
          <p className="relative mt-3 leading-[1.65] text-text-2">
            Seven days of split tables, hit rates, and the Profiler — free.
          </p>
          <div className="relative mt-7">
            <Link
              to="/register"
              className="inline-block rounded-md bg-sp-indigo px-6 py-3 text-[15px] font-semibold text-white transition-all duration-200 hover:brightness-110 hover:shadow-cta-glow active:scale-[0.97]"
            >
              Start free trial
            </Link>
          </div>
          <p className="data-mono relative mt-4 text-[12px] text-text-3">
            $0 today · Card required · Cancel anytime
          </p>
        </motion.div>
      </section>
    </div>
  )
}
