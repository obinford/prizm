import { Link } from 'react-router'
import { motion } from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

// NOTE: the All Access tools bento (S7) and testimonials (S9) sections were
// removed — they referenced product screenshots and avatar photos that don't
// exist yet. They return when real assets ship (see PHASE 0, task 0.6).
//
// FIX 13: the S10 pricing preview was removed with the rest of the pricing
// surface (plans deferred; pages/pricing/plans.ts survives unreferenced).

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
            See every side before tonight's first pitch.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.35, ease: EASE }}
            className="mt-9 flex flex-col items-center gap-3"
          >
            <Link
              to="/login"
              className="animate-ring-pulse rounded-md bg-sp-indigo px-8 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
            >
              Sign in
            </Link>
            <span className="data-mono text-xs text-text-3">Private beta — access by invitation</span>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export { FinalCTA }
