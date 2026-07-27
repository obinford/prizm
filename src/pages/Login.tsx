import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { motion } from 'framer-motion'
import { Check, Eye, EyeOff, Loader2 } from 'lucide-react'
import AuthSplit from '@/pages/login/AuthSplit'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

const inputClass = (err: boolean) =>
  `h-11 w-full rounded-sm border bg-bg-2 px-3 text-[15px] text-text-1 placeholder:text-text-3 transition-colors focus:outline-none focus:ring-[3px] ${
    err
      ? 'border-danger focus:border-danger focus:ring-[rgba(248,113,113,0.25)]'
      : 'border-line focus:border-sp-indigo focus:ring-[rgba(99,102,241,0.25)]'
  }`

export default function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const registered = params.get('registered') === '1'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState<{ email?: boolean; password?: boolean }>({})
  const [failed, setFailed] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const emailOk = /^\S+@\S+\.\S+$/.test(email)
    const pwOk = password.length >= 6
    setErrors({ email: !emailOk, password: !pwOk })
    if (!emailOk || !pwOk) {
      setShakeKey((k) => k + 1)
      return
    }
    setSubmitting(true)
    // Demo: simulate credential check — demo@prizm.bet / prizmdemo signs in.
    setTimeout(() => {
      if (email.toLowerCase() === 'demo@prizm.bet' && password === 'prizmdemo') {
        navigate('/dashboard')
      } else {
        setSubmitting(false)
        setFailed(true)
        setShakeKey((k) => k + 1)
      }
    }, 700)
  }

  return (
    <AuthSplit
      bullets={[
        'Split tables for every prop on tonight\u2019s board',
        'L5/L10/L20 hit rates with price alerts',
        'Ask Prizm — answers with receipts',
      ]}
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-semibold text-sp-indigo transition hover:brightness-125">
            Start your 7-day trial
          </Link>
        </>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="mx-auto w-full max-w-[400px]"
      >
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.01em] text-text-1">
          Welcome back.
        </h1>
        <p className="mt-2 text-sm text-text-2">Sign in to pick up tonight&rsquo;s research.</p>

        {registered && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="mt-4 flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3.5 py-2.5 text-[13px] text-success"
          >
            <Check size={14} strokeWidth={2.5} /> Trial started — sign in to explore the app.
          </motion.p>
        )}

        {failed && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger"
          >
            That email/password combo didn&rsquo;t match. Try the demo credentials below.
          </motion.p>
        )}

        <motion.form
          key={shakeKey}
          initial={false}
          animate={shakeKey > 0 ? { x: [0, -8, 8, -5, 5, 0] } : false}
          transition={{ duration: 0.3 }}
          onSubmit={submit}
          noValidate
          className="mt-7 space-y-4"
        >
          <div>
            <label htmlFor="login-email" className="overline-caption mb-2 block text-text-3">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@sharp.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (errors.email) setErrors((p) => ({ ...p, email: false }))
              }}
              className={inputClass(!!errors.email)}
            />
            {errors.email && <p className="mt-1.5 text-[13px] text-danger">Enter a valid email.</p>}
          </div>

          <div>
            <label htmlFor="login-password" className="overline-caption mb-2 block text-text-3">
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (errors.password) setErrors((p) => ({ ...p, password: false }))
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
            {errors.password && (
              <p className="mt-1.5 text-[13px] text-danger">Use at least 6 characters.</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-2">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded-sm border-line bg-bg-2 accent-sp-indigo"
              />
              Remember me
            </label>
            <Link to="/faq" className="text-sm text-sp-indigo transition hover:brightness-125">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-sp-indigo text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 hover:shadow-cta-glow active:scale-[0.97] disabled:opacity-80"
          >
            {submitting && <Loader2 size={17} className="animate-spin" aria-label="Signing in" />}
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </motion.form>

        {/* Demo credentials hint */}
        <div className="mt-6 rounded-md border border-line bg-bg-1 px-4 py-3">
          <p className="data-mono text-[12px] leading-relaxed text-text-3">
            Demo — <span className="text-text-2">demo@prizm.bet</span> /{' '}
            <span className="text-text-2">prizmdemo</span>
          </p>
        </div>
      </motion.div>
    </AuthSplit>
  )
}
