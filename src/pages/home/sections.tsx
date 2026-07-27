import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { motion, useInView, useMotionValue, useSpring, animate } from 'framer-motion'
import { ArrowRight, Bookmark, Check, Layers, Palette, Waves } from 'lucide-react'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

// ---------------------------------------------------------------------------
// S3 — Stat band
// ---------------------------------------------------------------------------

function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const [display, setDisplay] = useState('0')
  useEffect(() => {
    if (!inView) return
    const controls = animate(0, target, {
      duration: 1.2,
      ease: EASE,
      onUpdate: (v) => setDisplay(Math.round(v).toLocaleString('en-US')),
    })
    return () => controls.stop()
  }, [inView, target])
  return (
    <span ref={ref} className="data-mono text-4xl font-bold text-text-1 md:text-5xl">
      {display}
      {suffix}
    </span>
  )
}

function StatBand() {
  const stats: { value: React.ReactNode; label: string }[] = [
    { value: <Counter target={2400} suffix="+" />, label: 'Player profiles' },
    { value: <Counter target={18} />, label: 'Stat markets tracked' },
    {
      value: (
        <span className="data-mono text-4xl font-bold text-text-1 md:text-5xl">30–240</span>
      ),
      label: 'Rolling window range',
    },
    { value: <Counter target={2} />, label: 'Sports, one prism' },
  ]
  return (
    <section className="border-y border-line bg-bg-1">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
            className={`flex flex-col items-center gap-2 px-6 py-10 text-center ${
              i > 0 ? 'border-l border-line' : ''
            } ${i > 1 ? 'max-lg:border-t max-lg:border-line' : ''} ${i === 2 ? 'max-lg:border-l-0' : ''}`}
          >
            {s.value}
            <span className="text-sm text-text-3">{s.label}</span>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// S4 — Two sports, one prism
// ---------------------------------------------------------------------------

function TiltCard({
  accent,
  title,
  bullets,
  linkText,
  to,
  delay,
}: {
  accent: string
  title: string
  bullets: string[]
  linkText: string
  to: string
  delay: number
}) {
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const srx = useSpring(rx, { stiffness: 200, damping: 20 })
  const sry = useSpring(ry, { stiffness: 200, damping: 20 })

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      style={{ perspective: 1000 }}
    >
      <motion.div
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          ry.set(((e.clientX - r.left) / r.width - 0.5) * 8)
          rx.set(-((e.clientY - r.top) / r.height - 0.5) * 8)
        }}
        onMouseLeave={() => {
          rx.set(0)
          ry.set(0)
        }}
        style={{ rotateX: srx, rotateY: sry, transformStyle: 'preserve-3d' }}
        className="group overflow-hidden rounded-xl border border-line bg-bg-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
      >
        <div className="h-[3px] w-full transition-shadow duration-300" style={{ background: accent }} />
        {/* Decorative refraction panel (no screenshot until real ones exist):
            a light beam fanning into the card's accent spectrum. */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-bg-0" aria-hidden>
          <div
            className="absolute left-0 top-1/2 h-px w-[38%]"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.85))' }}
          />
          <div
            className="absolute left-[36%] top-[14%] h-[72%] w-px opacity-70"
            style={{ background: 'linear-gradient(180deg, transparent, rgba(226,232,255,0.6), transparent)' }}
          />
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="absolute left-[36%] top-1/2 h-[2px] w-[62%] origin-left rounded-full transition-transform duration-500 group-hover:scale-x-105"
              style={{
                background: accent,
                opacity: 0.28 + i * 0.14,
                transform: `rotate(${-14 + i * 7}deg)`,
                filter: 'blur(0.5px)',
              }}
            />
          ))}
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(55% 65% at 36% 50%, rgba(99,102,241,0.16), transparent 72%)' }}
          />
          <div className="noise-overlay pointer-events-none absolute inset-0" />
        </div>
        <div className="p-7">
          <h3 className="font-display text-2xl font-semibold text-text-1">{title}</h3>
          <ul className="mt-4 space-y-2.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-[15px] text-text-2">
                <Check size={16} className="mt-0.5 shrink-0 text-sp-cyan" />
                {b}
              </li>
            ))}
          </ul>
          <Link
            to={to}
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-sp-indigo transition-colors hover:brightness-125"
          >
            {linkText}
            <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>
      </motion.div>
    </motion.div>
  )
}

function TwoSports() {
  return (
    <section className="bg-bg-0 py-[120px] max-lg:py-[72px]">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="font-display font-semibold text-text-1" style={{ fontSize: 'clamp(30px, 4vw, 40px)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Two sports. <span className="text-spectrum">One prism.</span>
          </h2>
          <p className="mt-4 text-lg leading-[1.65] text-text-2">
            Purpose-built dashboards for the daily grind — baseball's long season and hockey's
            fast slate.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <TiltCard
            accent="linear-gradient(90deg, #FBBF24, #FB923C)"
            title="MLB Dashboards"
            bullets={[
              'Starting pitcher split tables',
              'Batting lineup stats',
              'Bullpen dashboard',
              '30/60/90/120 PA windows',
            ]}
            linkText="Open MLB preview →"
            to="/dashboard"
            delay={0}
          />
          <TiltCard
            accent="linear-gradient(90deg, #22D3EE, #2DD4BF)"
            title="NHL Dashboards"
            bullets={[
              'Goalie SV% & GSAx splits',
              'Skater SOG/points windows',
              'Team stat context',
              '60/120/180/240 min windows',
            ]}
            linkText="Open NHL preview →"
            to="/dashboard/hockey"
            delay={0.15}
          />
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// S6 — Value props
// ---------------------------------------------------------------------------

const VALUE_PROPS = [
  {
    icon: Layers,
    title: 'Every stat, one place',
    body: 'Season baselines, rolling windows, splits, and prop lines live in the same table. No more five-tab research.',
  },
  {
    icon: Waves,
    title: 'Rolling windows that matter',
    body: '30/60/90/120 PA for MLB, 60–240 minutes for NHL. Form, not noise.',
  },
  {
    icon: Palette,
    title: 'Color-coded context',
    body: 'Red means better than baseline, blue means worse. Your eye finds the edge before your brain reads the number.',
  },
  {
    icon: Bookmark,
    title: 'Views & angles that stick',
    body: 'Pin filters, save view combos, and file every takeaway into My Angles — research that survives the night.',
  },
]

function ValueProps() {
  return (
    <section className="bg-bg-0 py-[120px] max-lg:py-[72px]">
      <div className="mx-auto max-w-[1200px] px-6">
        <h2 className="font-display mb-14 max-w-2xl font-semibold text-text-1" style={{ fontSize: 'clamp(30px, 4vw, 40px)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          One beam in. <span className="text-spectrum">Every angle out.</span>
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {VALUE_PROPS.map((v, i) => (
            <motion.div
              key={v.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: EASE }}
              whileHover={{ y: -4 }}
              className="group rounded-lg border border-line bg-bg-1 p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors duration-300 hover:border-line-strong"
            >
              <motion.div
                initial={{ rotate: -8 }}
                whileInView={{ rotate: 0 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', stiffness: 260, damping: 14, delay: i * 0.1 }}
                className="mb-5 flex h-11 w-11 items-center justify-center rounded-md border border-line bg-bg-2 transition-colors duration-300 group-hover:bg-[rgba(99,102,241,0.15)]"
              >
                <v.icon size={18} strokeWidth={1.5} className="text-sp-cyan" />
              </motion.div>
              <h3 className="font-display text-2xl font-semibold text-text-1">{v.title}</h3>
              <p className="mt-2.5 leading-[1.6] text-text-2">{v.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export { StatBand, TwoSports, ValueProps }
