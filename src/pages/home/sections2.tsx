import { useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

// NOTE: the All Access tools bento (S7) and testimonials (S9) sections were
// removed — they referenced product screenshots and avatar photos that don't
// exist yet. They return when real assets ship (see PHASE 0, task 0.6).

// ---------------------------------------------------------------------------
// S10 — Pricing preview
// ---------------------------------------------------------------------------

const PLANS = [
  {
    name: 'Dashboards Only',
    monthly: 12.99,
    annual: 9.99,
    features: ['MLB + NHL split tables', 'Hit Rates scanner', 'Profiler & GameCenter', 'Saved views & filters'],
    spectrum: false,
  },
  {
    name: 'All Access',
    monthly: 24.99,
    annual: 19.99,
    features: ['Everything in Dashboards', 'Hit Rates — full slate', 'EdgeCenter full board', 'My Angles + sharing'],
    spectrum: true,
  },
]

function PricingPreview() {
  const [annual, setAnnual] = useState(false)

  return (
    <section className="bg-bg-0 py-[120px] max-lg:py-[72px]">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="mb-10 text-center">
          <h2 className="font-display font-semibold text-text-1" style={{ fontSize: 'clamp(30px, 4vw, 40px)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            One beam. Two plans.
          </h2>
          {/* Segmented toggle */}
          <div className="mt-6 inline-flex rounded-full bg-bg-2 p-1">
            {(['Monthly', 'Annual'] as const).map((label) => {
              const isActive = (label === 'Annual') === annual
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setAnnual(label === 'Annual')}
                  className={`relative rounded-full px-5 py-2 text-sm font-semibold transition-colors duration-200 ${
                    isActive ? 'bg-bg-3 text-sp-indigo' : 'text-text-2 hover:text-text-1'
                  }`}
                >
                  {label}
                  {label === 'Annual' && (
                    <span className="data-mono ml-1.5 text-[10px] text-sp-lime">−20%</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
          {PLANS.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 32, scale: p.spectrum ? 1 : 1 }}
              whileInView={{ opacity: 1, y: 0, scale: p.spectrum ? 1.02 : 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: i * 0.12, ease: EASE }}
              className="relative rounded-xl bg-bg-1 p-7"
              style={{
                border: p.spectrum ? '1.5px solid transparent' : '1px solid rgba(99,102,241,0.5)',
                background: p.spectrum
                  ? 'linear-gradient(var(--bg-1), var(--bg-1)) padding-box, var(--gradient-spectrum) border-box'
                  : undefined,
                boxShadow: p.spectrum ? '0 0 32px rgba(99,102,241,0.25)' : undefined,
              }}
            >
              {p.spectrum && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-sm px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] text-white"
                  style={{ background: 'var(--gradient-spectrum)' }}
                >
                  BEST VALUE
                </span>
              )}
              <h3 className="font-display text-xl font-semibold text-text-1">{p.name}</h3>
              <p className="mt-4">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={annual ? 'a' : 'm'}
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -12, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="data-mono inline-block text-4xl font-bold text-text-1"
                  >
                    ${(annual ? p.annual : p.monthly).toFixed(2)}
                  </motion.span>
                </AnimatePresence>
                <span className="text-sm text-text-3">/mo{annual ? ' · billed annually' : ''}</span>
              </p>
              <ul className="mt-5 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-text-2">
                    <CheckIcon />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center">
          <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-sp-indigo hover:brightness-125">
            Compare plans <ArrowRightIcon />
          </Link>
        </p>
      </div>
    </section>
  )
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-sp-cyan">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// S11 — Final CTA
// ---------------------------------------------------------------------------

function FinalCTA() {
  return (
    <section className="bg-bg-0 px-6 pb-[120px] max-lg:pb-[72px]">
      <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-xl">
        {/* Ken Burns background */}
        <div
          className="absolute inset-0 animate-kenburns bg-cover bg-center"
          style={{ backgroundImage: "url('/hero-prism.png')" }}
        />
        <div className="absolute inset-0 bg-[rgba(7,8,15,0.7)]" />
        <div className="noise-overlay pointer-events-none absolute inset-0" />

        <div className="relative flex flex-col items-center px-6 py-24 text-center md:py-32">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.4 }}
            transition={{ staggerChildren: 0.08 }}
            className="font-display max-w-3xl font-bold text-text-1"
            style={{ fontSize: 'clamp(34px, 5vw, 52px)', lineHeight: 1.05, letterSpacing: '-0.02em' }}
          >
            {['Stop', 'betting'].map((w) => (
              <motion.span
                key={w}
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } }}
                className="mr-3 inline-block"
              >
                {w}
              </motion.span>
            ))}
            <motion.span
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } }}
              className="text-spectrum inline-block"
            >
              one-dimensional.
            </motion.span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.25, ease: EASE }}
            className="mt-5 max-w-xl text-lg leading-[1.65] text-text-2"
          >
            Start your 7-day free trial. Card required, cancel anytime — see every side before
            tonight's first pitch.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.35, ease: EASE }}
            className="mt-9 flex flex-col items-center gap-3"
          >
            <Link
              to="/register"
              className="animate-ring-pulse rounded-md bg-sp-indigo px-8 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
            >
              Start 7-day free trial
            </Link>
            <span className="data-mono text-xs text-text-3">7 days free · then from $12.99/mo</span>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export { PricingPreview, FinalCTA }
