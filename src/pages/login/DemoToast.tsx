import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

/** Demo toast — bottom-right, bg-2, 3px spectrum left bar, auto-dismiss 3.5s. */
export default function DemoToast({
  message,
  onDismiss,
}: {
  message: string | null
  onDismiss: () => void
}) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [message, onDismiss])

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[60]">
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.25, ease: EASE }}
            role="status"
            className="relative overflow-hidden rounded-md border border-line bg-bg-2 py-3 pl-5 pr-4 shadow-raised"
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-[3px]"
              style={{ background: 'var(--gradient-spectrum)' }}
            />
            <p className="text-sm font-medium text-text-1">{message}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
