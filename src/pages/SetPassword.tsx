// First-time account setup (FIX 12).
//
// The owner lands here from the one-time link printed to the server console
// at first boot (/set-password?token=...). He sets his own password — the
// plaintext never exists anywhere but his keyboard and the argon2id hash
// the server stores. The token is single-use with a 60-minute expiry; a
// dead link means a fresh one from a server restart or `npm run setup-url`.

import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { motion } from 'framer-motion'
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import AuthSplit from '@/pages/login/AuthSplit'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]
const MIN_PASSWORD_LEN = 10

const inputClass = (err: boolean) =>
  `h-11 w-full rounded-sm border bg-bg-2 px-3 text-[15px] text-text-1 placeholder:text-text-3 transition-colors focus:outline-none focus:ring-[3px] ${
    err
      ? 'border-danger focus:border-danger focus:ring-[rgba(248,113,113,0.25)]'
      : 'border-line focus:border-sp-indigo focus:ring-[rgba(99,102,241,0.25)]'
  }`

export default function SetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [dead, setDead] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: { password?: string; confirm?: string } = {}
    if (password.length < MIN_PASSWORD_LEN) next.password = `Use at least ${MIN_PASSWORD_LEN} characters.`
    if (confirm !== password) next.confirm = 'Passwords do not match.'
    setErrors(next)
    if (next.password || next.confirm) return
    setSubmitting(true)
    setServerError(null)
    try {
      const resp = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
        credentials: 'same-origin',
      })
      if (resp.ok) {
        window.location.assign('/dashboard')
        return
      }
      setSubmitting(false)
      if (resp.status === 410) {
        setDead(true)
      } else {
        const body = (await resp.json().catch(() => null)) as { error?: string } | null
        setServerError(body?.error ?? 'Something went wrong. Try again.')
      }
    } catch {
      setSubmitting(false)
      setServerError('Couldn’t reach the server. Check that the app is running and try again.')
    }
  }

  const deadLink = !token || dead

  return (
    <AuthSplit
      checklist={[
        'One account, one owner — this link works exactly once',
        'Your password is hashed with argon2id and never stored in plaintext',
        'The link dies after one use or 60 minutes',
      ]}
      footer={
        <span className="text-text-3">
          Already set up?{' '}
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
        {deadLink ? (
          <div>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md border border-sp-amber/40 bg-sp-amber/10">
              <KeyRound size={20} strokeWidth={1.5} className="text-sp-amber" />
            </div>
            <h1 className="font-display text-[28px] font-semibold tracking-[-0.01em] text-text-1">
              This setup link is dead.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-text-2">
              Setup links are single-use and expire after 60 minutes — this one is missing, was
              already used, or has expired.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-text-2">
              Get a fresh one by restarting the server, or by running{' '}
              <code className="data-mono rounded-sm border border-line bg-bg-2 px-1.5 py-0.5 text-[12px] text-text-1">
                npm run setup-url
              </code>{' '}
              on the host machine. The new link prints to the server console.
            </p>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md border border-sp-indigo/40 bg-sp-indigo/10">
              <KeyRound size={20} strokeWidth={1.5} className="text-sp-indigo" />
            </div>
            <h1 className="font-display text-[28px] font-semibold tracking-[-0.01em] text-text-1">
              Set your password.
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-text-2">
              One account, one owner. Choose a password you don&rsquo;t reuse anywhere else — this
              is the only way in.
            </p>

            {serverError && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger"
              >
                {serverError}
              </motion.p>
            )}

            <form onSubmit={submit} noValidate className="mt-7 space-y-4">
              <div>
                <label htmlFor="new-password" className="overline-caption mb-2 block text-text-3">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder={`At least ${MIN_PASSWORD_LEN} characters`}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (errors.password) setErrors((p) => ({ ...p, password: undefined }))
                    }}
                    className={`${inputClass(!!errors.password)} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 transition-colors hover:text-text-1"
                  >
                    {showPw ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
                  </button>
                </div>
                {errors.password && <p className="mt-1.5 text-[13px] text-danger">{errors.password}</p>}
              </div>

              <div>
                <label htmlFor="confirm-password" className="overline-caption mb-2 block text-text-3">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Same password again"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value)
                    if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined }))
                  }}
                  className={inputClass(!!errors.confirm)}
                />
                {errors.confirm && <p className="mt-1.5 text-[13px] text-danger">{errors.confirm}</p>}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-sp-indigo text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 hover:shadow-cta-glow active:scale-[0.97] disabled:opacity-80"
              >
                {submitting && <Loader2 size={17} className="animate-spin" aria-label="Setting password" />}
                {submitting ? 'Setting password…' : 'Set password and sign in'}
              </button>
            </form>
          </div>
        )}
      </motion.div>
    </AuthSplit>
  )
}
