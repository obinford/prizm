import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Gem, Search } from 'lucide-react'
import FaqItem from '@/pages/faq/FaqItem'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

interface FaqEntry {
  category: string
  q: string
  a: string
}

const CATEGORIES = [
  'Getting started',
  'Plans & billing',
  'Data & windows',
  'Tools',
  'Responsible use',
] as const

const FAQS: FaqEntry[] = [
  {
    category: 'Getting started',
    q: 'What is Prizm?',
    a: 'A research dashboard for MLB & NHL prop bettors and DFS players. We turn raw stats into rolling-window, color-coded split tables plus AI tools, so you can see every side of a bet before you place it.',
  },
  {
    category: 'Getting started',
    q: 'Is Prizm a sportsbook?',
    a: 'No. We never take bets or hold funds. We show prices for context only.',
  },
  {
    category: 'Getting started',
    q: 'How does the 7-day trial work?',
    a: 'Card required up front; you are not charged until day 8. Cancel anytime in two clicks and keep your saved views and angles.',
  },
  {
    category: 'Getting started',
    q: 'Do I need to know advanced stats?',
    a: 'No. Red = better than baseline, blue = worse. The colors do the translating.',
  },
  {
    category: 'Plans & billing',
    q: "What's the difference between plans?",
    a: 'Dashboards Only ($12.99/mo, $149.99/yr) is the split tables for both sports. All Access ($24.99/mo, $249.99/yr) adds Hit Rates, Profiler, GameCenter, EdgeCenter, and My Angles.',
  },
  {
    category: 'Plans & billing',
    q: 'Can I switch or cancel?',
    a: 'Anytime; upgrades are prorated instantly, cancellations keep access until period end.',
  },
  {
    category: 'Plans & billing',
    q: 'Refunds?',
    a: 'First month, no questions asked.',
  },
  {
    category: 'Data & windows',
    q: 'What are rolling windows?',
    a: "A player's stats over their most recent workload: last 30/60/90/120 plate appearances (MLB) or last 60/120/180/240 minutes (NHL), each compared against their season baseline.",
  },
  {
    category: 'Data & windows',
    q: 'What do the colors mean?',
    a: "Each cell is shaded on a red ramp (better than season baseline — good for the bettor's angle) or blue ramp (worse). Every cell also shows the signed delta, so color is never the only signal.",
  },
  {
    category: 'Data & windows',
    q: 'How fresh is the data?',
    // "30+ sportsbooks": warehouse-verified 2026-07-28 —
    //   select count(distinct b) from (
    //     select over_book as b from sv_odds where over_book is not null
    //     union select under_book from sv_odds where under_book is not null) t;
    //   → 32 distinct entries, 30 distinct brands (Hard Rock Bet appears as
    //   three regional entries). Floor stays true as the feed grows; re-run
    //   the query to re-check. Previously "34 books" — wrong under both counts.
    a: 'MLB stats refresh nightly from official MLB feeds plus the Statcast warehouse; NHL stats refresh from official NHL feeds. Odds are aggregated book lines (30+ sportsbooks) refreshed daily.',
  },
  {
    category: 'Tools',
    q: 'What is a price alert in Hit Rates?',
    a: "When a prop's hit rate implies value versus the listed price, the row gets a Zap flag. It's a research signal, not a recommendation.",
  },
  {
    category: 'Tools',
    q: 'What are Angles?',
    a: 'Saved research takeaways. From any table, save rows to an angle card with your notes; cards are shareable via link.',
  },
  {
    category: 'Responsible use',
    q: 'Who is Prizm for?',
    a: 'Adults 21+ doing their own research. Variance is real; no tool removes it. Bet only what you can afford to lose.',
  },
]

export default function Faq() {
  const [activeCat, setActiveCat] = useState<string>('All')
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  // 150ms debounce on live search
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().toLowerCase()), 150)
    return () => clearTimeout(t)
  }, [query])

  const filtered = useMemo(() => {
    return FAQS.filter((f) => {
      if (activeCat !== 'All' && f.category !== activeCat) return false
      if (!debounced) return true
      return f.q.toLowerCase().includes(debounced) || f.a.toLowerCase().includes(debounced)
    })
  }, [activeCat, debounced])

  const groups = useMemo(() => {
    const map = new Map<string, FaqEntry[]>()
    for (const f of filtered) {
      const list = map.get(f.category) ?? []
      list.push(f)
      map.set(f.category, list)
    }
    return [...map.entries()]
  }, [filtered])

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="bg-bg-0">
      {/* S1 — Header */}
      <section className="px-6 pb-10 pt-20 max-lg:pt-14">
        <div className="mx-auto max-w-[840px]">
          <div className="inline-block">
            <span className="overline-caption text-sp-indigo">Support</span>
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
              {['Questions,', 'answered.'].map((w, i) => (
                <motion.span
                  key={w}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
                  }}
                  className={`mr-3 inline-block last:mr-0 ${i === 1 ? 'text-spectrum' : ''}`}
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
            className="mt-4 max-w-xl text-lg leading-[1.65] text-text-2"
          >
            Everything about plans, trials, data, and how Prizm reads a bet.
          </motion.p>
        </div>
      </section>

      {/* S2 — Sticky search + category chips */}
      <div className="sticky top-[72px] z-30 border-b border-line bg-bg-0/85 backdrop-blur-[16px]">
        <div className="mx-auto max-w-[840px] px-6 py-4">
          <div className="relative">
            <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-3" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search questions…"
              aria-label="Search questions"
              className="h-11 w-full rounded-sm border border-line bg-bg-2 pl-10 pr-4 text-[15px] text-text-1 placeholder:text-text-3 focus:border-sp-indigo focus:outline-none focus:ring-[3px] focus:ring-[rgba(99,102,241,0.25)]"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {['All', ...CATEGORIES].map((cat, i) => {
              const isActive = activeCat === cat
              return (
                <motion.button
                  key={cat}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05, ease: EASE }}
                  onClick={() => setActiveCat(cat)}
                  className={`relative rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-200 ${
                    isActive ? 'text-sp-indigo' : 'bg-bg-2 text-text-2 hover:text-text-1'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="faq-chip"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      className="absolute inset-0 rounded-full border border-sp-indigo/40 bg-bg-3"
                    />
                  )}
                  <span className="relative">{cat}</span>
                </motion.button>
              )
            })}
          </div>
        </div>
      </div>

      {/* S3 — Accordion groups */}
      <section className="px-6 py-14">
        <div className="mx-auto max-w-[840px]">
          {groups.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-4 rounded-lg border border-line bg-bg-1 px-6 py-16 text-center"
            >
              <Gem size={28} strokeWidth={1.5} className="text-text-3" />
              <p className="text-sm text-text-2">No questions match that search.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setActiveCat('All')
                }}
                className="rounded-md border border-line bg-bg-2 px-4 py-2 text-sm font-medium text-text-1 transition-colors hover:bg-bg-3"
              >
                Reset filters
              </button>
            </motion.div>
          ) : (
            groups.map(([cat, items]) => (
              <div key={cat} className="mb-10 last:mb-0">
                <motion.h2
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="overline-caption mb-2 text-text-3"
                >
                  {cat}
                </motion.h2>
                <div>
                  <AnimatePresence initial={false}>
                    {items.map((f, i) => (
                      <motion.div
                        key={f.q}
                        layout="position"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                        transition={{ duration: 0.2, delay: i * 0.05, ease: EASE }}
                      >
                        <FaqItem qa={f} open={openIds.has(f.q)} onToggle={() => toggle(f.q)} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* S4 — Still stuck band */}
      <section className="px-6 pb-[120px] max-lg:pb-[72px]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mx-auto flex max-w-[840px] flex-col items-center rounded-lg border border-line bg-bg-1 px-6 py-12 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
        >
          <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-text-1">
            Still guessing?
          </h2>
          <p className="mt-3 max-w-md leading-[1.65] text-text-2">
            Questions the FAQ doesn&apos;t cover? Email{' '}
            <a href="mailto:support@prizm.bet" className="text-sp-indigo hover:brightness-125">
              support@prizm.bet
            </a>
            .
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/register"
              className="rounded-md bg-sp-indigo px-5 py-[11px] text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 hover:shadow-cta-glow active:scale-[0.97]"
            >
              Start free trial
            </Link>
            <a
              href="mailto:support@prizm.bet"
              className="flex items-center gap-1.5 rounded-md border border-line bg-bg-2 px-5 py-[11px] text-sm font-medium text-text-1 transition-colors hover:bg-bg-3"
            >
              Contact support <ArrowRight size={14} />
            </a>
          </div>
        </motion.div>
      </section>
    </div>
  )
}
