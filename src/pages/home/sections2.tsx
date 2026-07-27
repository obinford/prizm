import { useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3,
  Bookmark,
  Crosshair,
  ScanLine,
  Sparkles,
  Target,
  UserRound,
  X,
  Zap,
} from 'lucide-react'
import { TESTIMONIALS } from '@/data/testimonials'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

// ---------------------------------------------------------------------------
// S7 — All Access tools bento
// ---------------------------------------------------------------------------

interface Tool {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  title: string
  line: string
  badge: 'All Access' | 'Both plans'
  chip?: string
  shot?: string
  span: string
}

const TOOLS: Tool[] = [
  { icon: Target, title: 'GameCenter', line: 'AI-style breakdowns for every game on the slate.', badge: 'Both plans', shot: '/shot-dashboard.png', span: 'md:col-span-4 md:row-span-2' },
  { icon: Crosshair, title: 'EdgeCenter', line: 'The morning brief: ranked edges, one page.', badge: 'All Access', shot: '/edge-brief.png', span: 'md:col-span-2 md:row-span-2' },
  { icon: UserRound, title: 'Profiler', line: 'Game logs, splits, batted ball, news — one player deep.', badge: 'Both plans', shot: '/shot-hitrates.png', span: 'md:col-span-2' },
  { icon: Sparkles, title: 'Ask Prizm', line: 'Plain-English answers with the receipts attached.', badge: 'All Access', chip: 'AI', shot: '/shot-ask.png', span: 'md:col-span-2' },
  { icon: Bookmark, title: 'My Angles', line: 'File, share, and track every research takeaway.', badge: 'Both plans', shot: '/shot-dashboard.png', span: 'md:col-span-2' },
  { icon: Zap, title: 'Hockey dashboards', line: 'Goalie SV% & GSAx, skater SOG/points windows.', badge: 'Both plans', shot: '/shot-hockey.png', span: 'md:col-span-2' },
  { icon: ScanLine, title: 'Hit Rates', line: 'L5/L10/L20 scanner with price-alert flags.', badge: 'Both plans', shot: '/shot-hitrates.png', span: 'md:col-span-2' },
  { icon: BarChart3, title: 'MLB dashboards', line: 'Pitcher splits, lineup stats, bullpen context.', badge: 'Both plans', shot: '/shot-dashboard.png', span: 'md:col-span-2' },
]

function ToolsBento() {
  const [activeTool, setActiveTool] = useState<Tool | null>(null)

  return (
    <section className="bg-bg-0 py-[120px] max-lg:py-[72px]">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="mb-14">
          <h2 className="font-display font-semibold text-text-1" style={{ fontSize: 'clamp(30px, 4vw, 40px)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            The All Access toolkit
          </h2>
          <p className="mt-4 text-lg text-text-2">Eight instruments, one subscription.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          {TOOLS.map((t, i) => (
            <motion.button
              key={t.title}
              type="button"
              onClick={() => setActiveTool(t)}
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: EASE }}
              className={`group relative overflow-hidden rounded-lg border border-line bg-bg-1 p-6 text-left transition-all duration-300 hover:border-transparent ${t.span}`}
              style={{ minHeight: 150 }}
            >
              {/* spectrum border sweep on hover */}
              <span
                className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  padding: 1,
                  background: 'var(--gradient-spectrum)',
                  WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                  WebkitMaskComposite: 'xor',
                  maskComposite: 'exclude',
                }}
              />
              {t.shot && t.span.includes('row-span-2') && (
                <div className="mb-4 overflow-hidden rounded-md border border-line">
                  <img src={t.shot} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <t.icon size={18} strokeWidth={1.5} className="text-sp-cyan transition-transform duration-300 group-hover:-translate-y-0.5" />
                <h3 className="font-display text-lg font-semibold text-text-1">{t.title}</h3>
                {t.chip && (
                  <span className="rounded-sm bg-sp-indigo/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-sp-cyan">
                    {t.chip}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-text-2">{t.line}</p>
              <span
                className={`data-mono mt-4 inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-medium tracking-wide ${
                  t.badge === 'All Access' ? 'text-white' : 'bg-sp-indigo/15 text-sp-indigo'
                }`}
                style={t.badge === 'All Access' ? { background: 'var(--gradient-spectrum)' } : undefined}
              >
                {t.badge === 'All Access' ? 'Included in All Access' : 'Both plans'}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Tool modal */}
      <AnimatePresence>
        {activeTool && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-[rgba(4,5,12,0.7)] backdrop-blur-[8px]"
              onClick={() => setActiveTool(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.22 }}
              className="fixed left-1/2 top-1/2 z-50 w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-bg-1 p-6 shadow-raised"
              role="dialog"
              aria-label={activeTool.title}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <activeTool.icon size={20} strokeWidth={1.5} className="text-sp-cyan" />
                  <h3 className="font-display text-2xl font-semibold text-text-1">{activeTool.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTool(null)}
                  className="rounded-md p-2 text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="mt-3 leading-relaxed text-text-2">{activeTool.line}</p>
              {activeTool.shot && (
                <div className="mt-5 overflow-hidden rounded-md border border-line">
                  <img src={activeTool.shot} alt={`${activeTool.title} preview`} className="aspect-[16/9] w-full object-cover" />
                </div>
              )}
              <Link
                to="/register"
                className="mt-6 block rounded-md bg-sp-indigo px-5 py-3 text-center text-sm font-semibold text-white transition-all hover:brightness-110 hover:shadow-cta-glow"
              >
                Start free trial
              </Link>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  )
}

// ---------------------------------------------------------------------------
// S9 — Testimonials
// ---------------------------------------------------------------------------

function Testimonials() {
  return (
    <section className="bg-bg-0 py-[120px] max-lg:py-[72px]">
      <div className="mx-auto max-w-[1200px] px-6">
        <h2 className="font-display mb-14 text-center font-semibold text-text-1" style={{ fontSize: 'clamp(30px, 4vw, 40px)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          Sharps see the spectrum.
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <motion.figure
              key={t.id}
              initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: i * 0.15, ease: EASE }}
              className="group rounded-lg border border-line bg-bg-1 p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors duration-300 hover:border-line-strong"
            >
              <span
                className="font-display block text-5xl leading-none transition-all duration-300 group-hover:drop-shadow-[0_0_12px_rgba(99,102,241,0.6)]"
                style={{
                  background: 'var(--gradient-spectrum)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                &ldquo;
              </span>
              <blockquote className="mt-3 leading-[1.65] text-text-2">{t.quote}</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <img src={t.avatar} alt={t.name} loading="lazy" className="h-10 w-10 rounded-full border border-line object-cover" />
                <div>
                  <p className="text-sm font-semibold text-text-1">{t.name}</p>
                  <p className="text-xs text-text-3">
                    {t.role}, {t.location}
                  </p>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  )
}

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
    features: ['Everything in Dashboards', 'Ask Prizm — unlimited', 'EdgeCenter full board', 'My Angles + sharing'],
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

export { ToolsBento, Testimonials, PricingPreview, FinalCTA }
