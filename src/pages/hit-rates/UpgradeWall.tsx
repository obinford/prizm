import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Gem, Zap } from 'lucide-react'
import { setPlan } from '@/lib/plan'
import { fmtUsd, monthlyEquivalent, planById, savingsPct } from '@/pages/pricing/plans'

// Price comes from the single source of truth (pricing/plans.ts). This wall
// once showed $29/$39 — a price that existed on no other page.
const ALL_ACCESS = planById('allaccess')

/**
 * Upgrade wall (hit-rates.md S4) — shown to `dashboards`-plan users after the
 * first 5 rows. Spectrum-bordered card + simulated plan modal.
 */
export default function UpgradeWall({ onUpgraded }: { onUpgraded: () => void }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [annual, setAnnual] = useState(true)

  const confirm = () => {
    setPlan('allaccess')
    setModalOpen(false)
    onUpgraded()
  }

  return (
    <div className="relative my-2">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 mx-auto max-w-lg rounded-xl p-[1.5px]"
        style={{ background: 'var(--gradient-spectrum)' }}
      >
        <div className="rounded-[22.5px] bg-bg-1 px-8 py-10 text-center">
          <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-bg-2">
            <Gem size={22} strokeWidth={1.5} className="text-sp-cyan" />
          </span>
          <h3 className="font-display text-2xl font-semibold text-text-1">
            Hit Rates is an <span className="text-spectrum">All Access</span> instrument.
          </h3>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-text-2">
            Unlock the full slate, price alerts, and every market — across MLB and NHL.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-7 rounded-md bg-sp-indigo px-6 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 hover:shadow-cta-glow active:scale-[0.97]"
          >
            Upgrade to All Access
          </button>
          <p className="mt-3 text-xs text-text-3">Simulated upgrade — no charge in this demo.</p>
        </div>
      </motion.div>

      {/* Plan modal */}
      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-[rgba(4,5,12,0.7)] backdrop-blur-[8px]"
              onClick={() => setModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.22 }}
              className="fixed left-1/2 top-1/2 z-50 w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-bg-1 p-6 shadow-raised"
              role="dialog"
              aria-label="Upgrade plan"
            >
              <h3 className="font-display text-xl font-semibold text-text-1">All Access</h3>
              <p className="mt-1 text-sm text-text-2">Every instrument, both sports, no walls.</p>

              <div className="mt-5 flex items-center rounded-full border border-line bg-bg-2 p-0.5">
                {(['Monthly', 'Annual'] as const).map((label) => {
                  const isAnnual = label === 'Annual'
                  const active = annual === isAnnual
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setAnnual(isAnnual)}
                      className={`relative flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors ${
                        active ? 'text-sp-indigo' : 'text-text-3 hover:text-text-2'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="plan-pill"
                          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                          className="absolute inset-0 rounded-full bg-bg-3"
                        />
                      )}
                      <span className="relative">{label}</span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 rounded-md border border-line bg-bg-2 px-4 py-3">
                <div className="flex items-baseline justify-between">
                  <span className="data-mono text-2xl font-bold text-text-1">
                    {annual ? fmtUsd(monthlyEquivalent(ALL_ACCESS)) : fmtUsd(ALL_ACCESS.monthlyPrice)}
                    <span className="text-sm font-medium text-text-3">/mo{annual ? ' · billed annually' : ''}</span>
                  </span>
                  {annual && (
                    <span className="rounded-sm bg-sp-indigo/20 px-1.5 py-0.5 text-[10px] font-semibold text-sp-indigo">
                      save {savingsPct(ALL_ACCESS)}%
                    </span>
                  )}
                </div>
                <ul className="mt-3 space-y-1.5 text-[13px] text-text-2">
                  {['Full hit-rate slate + price alerts', 'EdgeCenter full board', 'My Angles + sharing'].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check size={13} className="text-success" /> {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-md px-4 py-2.5 text-sm text-text-2 transition-colors hover:text-text-1"
                >
                  Not now
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  className="flex items-center gap-1.5 rounded-md bg-sp-indigo px-5 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97]"
                >
                  <Zap size={14} fill="currentColor" strokeWidth={1.5} />
                  Upgrade now
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
