import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Zap } from 'lucide-react'

/**
 * Summary strip (hit-rates.md S5) — slides up on scroll-up ≥200px,
 * hides on scroll down.
 */
export default function SummaryStrip({
  alertsCount,
  topLine,
  onExport,
}: {
  alertsCount: number
  topLine: string | null
  onExport: () => void
}) {
  const [visible, setVisible] = useState(false)
  const lastY = useRef(0)
  const acc = useRef(0)

  useEffect(() => {
    lastY.current = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const dy = y - lastY.current
      lastY.current = y
      acc.current = dy < 0 ? acc.current - dy : 0
      if (acc.current >= 200) setVisible(true)
      else if (dy > 12) setVisible(false)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.div
      initial={false}
      animate={{ y: visible ? 0 : 96, opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-none fixed bottom-4 left-1/2 z-30 w-[min(720px,calc(100vw-32px))] -translate-x-1/2"
      aria-hidden={!visible}
    >
      <div className="pointer-events-auto flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg border border-line bg-bg-2/95 px-4 py-2.5 shadow-raised backdrop-blur-md">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-sp-amber">
          <Zap size={14} fill="currentColor" strokeWidth={1.5} />
          {alertsCount} price alert{alertsCount === 1 ? '' : 's'} tonight
        </span>
        {topLine && (
          <span className="data-mono hidden min-w-0 flex-1 truncate text-[12px] text-text-2 sm:block">
            Top: {topLine}
          </span>
        )}
        <button
          type="button"
          onClick={onExport}
          className="ml-auto flex items-center gap-1.5 rounded-sm px-2 py-1 text-[12px] font-medium text-text-2 transition-colors hover:text-text-1"
        >
          <Download size={13} strokeWidth={1.5} />
          Export CSV
        </button>
      </div>
    </motion.div>
  )
}
