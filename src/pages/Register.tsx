// Register — invite-only (FIX 12).
//
// This used to simulate a self-serve signup: a plan picker and a credential
// form whose "create account" button stored nothing and let anyone straight
// in. There is exactly one account this week — the owner's — and it was
// created by migration seed, not by a public form. More users later is a
// real user-management feature, not a shared login and not a fake form.

import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { UserRound } from 'lucide-react'
import AuthSplit from '@/pages/login/AuthSplit'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

export default function Register() {
  return (
    <AuthSplit
      checklist={[
        'Split tables for every prop on tonight’s board',
        'L5/L10/L20 hit rates with price alerts',
        'Weather-adjusted park factors',
      ]}
      footer={
        <span className="text-text-3">
          Have an account?{' '}
          <Link to="/login" className="font-semibold text-sp-indigo transition hover:brightness-125">
            Sign in
          </Link>
        </span>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="mx-auto w-full max-w-[400px]"
      >
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md border border-sp-indigo/40 bg-sp-indigo/10">
          <UserRound size={20} strokeWidth={1.5} className="text-sp-indigo" />
        </div>
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.01em] text-text-1">
          Prizm is invite-only.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-text-2">
          There&rsquo;s no self-serve signup during the beta. Accounts are created by the owner —
          if you should have one, you already know who to ask.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-text-2">
          First time on a fresh install? The account setup link is printed to the server console
          on first boot — it is single-use and expires after 60 minutes.
        </p>
        <Link
          to="/login"
          className="mt-7 flex h-11 w-full items-center justify-center rounded-md bg-sp-indigo text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 hover:shadow-cta-glow active:scale-[0.97]"
        >
          Back to sign in
        </Link>
      </motion.div>
    </AuthSplit>
  )
}
