import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]
const NAV_OFFSET = 96 // 72px navbar + 24px breathing room

export interface LegalSection {
  id: string
  title: string
  body: ReactNode
}

/**
 * Shared dark legal layout: left sticky scroll-spy TOC (220px) +
 * right content column (max 720px). Mobile: TOC becomes an
 * "On this page" dropdown.
 */
export default function LegalPage({
  title,
  meta,
  sections,
}: {
  title: string
  meta: string
  sections: LegalSection[]
}) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? '')
  const activeRef = useRef(activeId)

  // Scroll-spy: active = last section whose top has passed the nav offset.
  useEffect(() => {
    activeRef.current = activeId
  }, [activeId])

  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        let current = sections[0]?.id ?? ''
        for (const s of sections) {
          const el = document.getElementById(s.id)
          if (el && el.getBoundingClientRect().top <= NAV_OFFSET + 24) current = s.id
        }
        // At (or near) the page bottom the final section may never cross the
        // nav offset — force the last TOC item active so it is reachable.
        const atBottom =
          window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 4
        if (atBottom && sections.length > 0) current = sections[sections.length - 1].id
        if (current !== activeRef.current) setActiveId(current)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
    }
  }, [sections])

  const jump = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const y = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET
    window.scrollTo({ top: y, behavior: 'smooth' })
    setActiveId(id)
  }

  return (
    <div className="bg-bg-0 px-6 pb-[120px] pt-16 max-lg:pt-12">
      <div className="mx-auto max-w-[1080px]">
        {/* S1 — Header */}
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <div className="inline-block">
            <span className="overline-caption text-sp-indigo">Legal</span>
            <div className="mt-2 h-px opacity-60" style={{ background: 'var(--gradient-spectrum)' }} />
          </div>
          <h1
            className="font-display mt-5 font-bold text-text-1"
            style={{ fontSize: 'clamp(34px, 5vw, 52px)', lineHeight: 1.05, letterSpacing: '-0.02em' }}
          >
            {title}
          </h1>
          <p className="data-mono mt-3 text-xs text-text-3">{meta}</p>
        </motion.header>

        {/* Mobile TOC — "On this page" dropdown */}
        <div className="mt-8 lg:hidden">
          <label htmlFor="legal-toc" className="overline-caption mb-2 block text-text-3">
            On this page
          </label>
          <select
            id="legal-toc"
            value={activeId}
            onChange={(e) => jump(e.target.value)}
            className="h-11 w-full rounded-sm border border-line bg-bg-2 px-3.5 text-base text-text-1 focus:border-sp-indigo focus:outline-none focus:ring-[3px] focus:ring-[rgba(99,102,241,0.25)]"
          >
            {sections.map((s, i) => (
              <option key={s.id} value={s.id}>
                {i + 1}. {s.title}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-12 flex gap-16">
          {/* S2 — Sticky TOC (desktop) */}
          <aside className="hidden w-[220px] shrink-0 lg:block">
            <nav aria-label="Table of contents" className="sticky top-[96px]">
              <span className="overline-caption mb-4 block text-text-3">On this page</span>
              <ul className="space-y-1">
                {sections.map((s, i) => {
                  const isActive = activeId === s.id
                  return (
                    <li key={s.id} className="relative">
                      {isActive && (
                        <motion.span
                          layoutId="legal-toc-bar"
                          transition={{ duration: 0.2, ease: EASE }}
                          className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-sp-indigo"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => jump(s.id)}
                        aria-current={isActive ? 'true' : undefined}
                        className={`block w-full py-1.5 pl-4 text-left text-[13px] transition-colors duration-200 ${
                          isActive ? 'font-medium text-text-1' : 'text-text-3 hover:text-text-2'
                        }`}
                      >
                        <span className="data-mono mr-1.5 text-[11px] text-text-3">{i + 1}.</span>
                        {s.title}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </aside>

          {/* S3 — Body sections */}
          <div className="min-w-0 max-w-[720px] flex-1">
            {sections.map((s, i) => (
              <motion.section
                key={s.id}
                id={s.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.4, ease: EASE }}
                className={i === 0 ? '' : 'mt-12 border-t border-line pt-12'}
              >
                <h2 className="font-display text-xl font-semibold text-text-1">
                  <span className="data-mono mr-2 text-sm font-medium text-text-3">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {s.title}
                </h2>
                <div className="mt-4 space-y-4 text-[15px] leading-[1.75] text-text-2">{s.body}</div>
              </motion.section>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
