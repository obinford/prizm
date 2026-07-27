import { memo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

/**
 * Rolling price digits: when `value` changes, each digit y-flips
 * (old −100% → 0, new 0 → +100%), 300ms, staggered 30ms per digit.
 * Non-digit characters ($, ., ,) stay static.
 */
function DigitRoll({ value, className }: { value: string; className?: string }) {
  return (
    <span className={`data-mono inline-flex items-baseline ${className ?? ''}`} aria-label={value}>
      {value.split('').map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} aria-hidden className="relative inline-flex h-[1.1em] items-center overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={ch}
                initial={{ y: '100%' }}
                animate={{ y: '0%' }}
                exit={{ y: '-100%' }}
                transition={{ duration: 0.3, delay: i * 0.03, ease: EASE }}
                className="inline-block"
              >
                {ch}
              </motion.span>
            </AnimatePresence>
          </span>
        ) : (
          <span key={i} aria-hidden className="inline-block">
            {ch}
          </span>
        ),
      )}
    </span>
  )
}

export default memo(DigitRoll)
