import { memo } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

/** Beam brightness pulse over the prism image (4s, isolated + memoized). */
const BeamPulse = memo(function BeamPulse() {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          'radial-gradient(45% 60% at 30% 40%, rgba(139,92,246,0.22), rgba(7,8,15,0) 70%)',
      }}
      animate={{ opacity: [0.4, 1, 0.4] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
})

/**
 * Split-screen auth shell: left 45% full-bleed auth-prism.png panel
 * (hidden <1024px), right centered form column on bg-0.
 * Mobile: image becomes a 160px header band with logo overlay.
 */
export default function AuthSplit({
  children,
  checklist,
  formWidth = 400,
}: {
  children: ReactNode
  checklist?: string[]
  formWidth?: number
}) {
  return (
    <div className="flex min-h-[100dvh] bg-bg-0">
      {/* Left panel (desktop) */}
      <div className="relative hidden w-[45%] overflow-hidden lg:block">
        <motion.img
          src="/auth-prism.png"
          alt=""
          initial={{ scale: 1.06 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.2, ease: EASE }}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(7,8,15,0.92) 0%, rgba(7,8,15,0.35) 45%, rgba(7,8,15,0.25) 100%)',
          }}
        />
        <BeamPulse />

        <div className="absolute bottom-0 left-0 p-10">
          <Link to="/" className="flex items-center gap-3" aria-label="Prizm home">
            <img src="/logo.svg" alt="" className="h-7 w-auto" />
            <span className="font-display text-[15px] font-bold tracking-[0.28em] text-text-1">
              PRIZM
            </span>
          </Link>
          <blockquote className="mt-8 max-w-sm text-lg leading-[1.65] text-text-1">
            “Prizm shows me the side of the bet the book hopes I miss.”
          </blockquote>
          <p className="mt-3 text-sm text-text-2">— Marcus D.</p>
          <div className="mt-6 h-px w-40 opacity-60" style={{ background: 'var(--gradient-spectrum)' }} />
          {checklist && (
            <ul className="mt-6 space-y-2.5">
              {checklist.map((item, i) => (
                <motion.li
                  key={item}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 + i * 0.08, ease: EASE }}
                  className="flex items-center gap-2.5 text-sm text-text-2"
                >
                  <Check size={15} strokeWidth={2} className="shrink-0 text-sp-cyan" />
                  {item}
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header band */}
        <div className="relative h-40 overflow-hidden lg:hidden">
          <img src="/auth-prism.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[rgba(7,8,15,0.45)]" />
          <Link to="/" className="absolute bottom-4 left-6 flex items-center gap-3" aria-label="Prizm home">
            <img src="/logo.svg" alt="" className="h-7 w-auto" />
            <span className="font-display text-[15px] font-bold tracking-[0.28em] text-text-1">
              PRIZM
            </span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full" style={{ maxWidth: formWidth }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
