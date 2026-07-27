// Prizm toast (design.md §7.10) — bottom-right, bg-2, 3px spectrum bar, 3.5s.
// Same visual contract as FilterBar's inline toast, shared by my two pages.

import { AnimatePresence, motion } from 'framer-motion'

export default function Toast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          role="status"
          className="fixed bottom-6 right-6 z-[70] flex items-center gap-3 overflow-hidden rounded-md border border-line bg-bg-2 py-3 pl-4 pr-5 shadow-raised"
        >
          <span
            className="absolute inset-y-0 left-0 w-[3px]"
            style={{ background: 'var(--gradient-spectrum)' }}
          />
          <span className="text-sm text-text-1">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
