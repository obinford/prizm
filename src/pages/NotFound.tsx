import { Link } from 'react-router'
import { motion } from 'framer-motion'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-0 px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="font-display text-[64px] font-bold text-spectrum">404</p>
        <p className="mt-2 text-lg text-text-2">This page is outside the strike zone.</p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-md bg-sp-indigo px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
        >
          Back to Prizm
        </Link>
      </motion.div>
    </div>
  )
}
