import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

export interface FaqQA {
  q: string
  a: string
}

/**
 * Single accordion item per design.md §7.10: plus→× rotate 250ms,
 * height auto-animation 350ms.
 */
export default function FaqItem({
  qa,
  open,
  onToggle,
}: {
  qa: FaqQA
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className={`text-[15px] font-medium transition-colors duration-200 ${open ? 'text-text-1' : 'text-text-2 hover:text-text-1'}`}>
          {qa.q}
        </span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          className={`shrink-0 rounded-sm border p-1 transition-colors duration-200 ${
            open ? 'border-line-strong text-sp-indigo' : 'border-line text-text-3'
          }`}
        >
          <Plus size={14} strokeWidth={1.5} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden"
          >
            <p className="max-w-[62ch] pb-5 text-[15px] leading-[1.75] text-text-2">{qa.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
