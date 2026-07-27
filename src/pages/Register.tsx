import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import { Check, Eye, EyeOff, Loader2 } from 'lucide-react'
import AuthSplit from '@/pages/login/AuthSplit'
import { Checkbox } from '@/components/ui/checkbox'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

const PLANS = [
  { id: 'dashboards', name: 'Dashboards Only', monthly: 12.99, annual: 149.99 },
  { id: 'allaccess', name: 'All Access', monthly: 24.99, annual: 249.99 },
] as const

const AFFILIATE_RE = /^[A-Z0-9]{4,10}$/
const STRENGTH_LABELS = ['Weak', 'Good', 'Strong']

const rise = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
}

const inputClass = (err: boolean, mono = false) =>
  `h-11 w-full rounded-sm border bg-bg-2 px-3 text-[15px] text-text-1 placeholder:text-text-3 transition-colors focus:outline-none focus:ring-[3px] ${mono ? 'data-mono' : ''} ${
    err
      ? 'border-danger focus:border-danger focus:ring-[rgba(248,113,113,0.25)]'
      : 'border-line focus:border-sp-indigo focus:ring-[rgba(99,102,241,0.25)]'
  }`

export default function Register() {
  const navigate = useNavigate()

  const [planId, setPlanId] = useState<'dashboards' | 'allaccess'>('allaccess')
  const [cadence, setCadence] = useState<'monthly' | 'annual'>('monthly')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [affiliate, setAffiliate] = useState('')
  const [terms, setTerms] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>('idle')

  const selectedPlan = PLANS.find((p) => p.id === planId)!
  const priceLabel =
    cadence === 'monthly'
      ? `$${selectedPlan.monthly.toFixed(2)}/mo`
      : `$${selectedPlan.annual.toFixed(2)}/yr`

  const score = useMemo(() => {
    if (password.length === 0) return 0
    if (password.length < 6) return 1
    const strong = password.length >= 10 && /[A-Z]/.test(password) && /\d/.test(password)
    return strong ? 3 : 2
  }, [password])

  const affiliateValid = AFFILIATE_RE.test(affiliate)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = {
      name: name.trim().length === 0,
      email: !/^\S+@\S+\.\S+$/.test(email),
      password: password.length < 6,
      terms: !terms,
    }
    setErrors(next)
    if (Object.values(next).some(Boolean)) return
    setPhase('loading')
    setTimeout(() => setPhase('done'), 900)
    setTimeout(() => navigate('/login?registered=1'), 1700)
  }

  return (
    <AuthSplit
      bullets={[
        'Split tables for every prop on tonight\u2019s board',
        'L5/L10/L20 hit rates with price alerts',
        'Ask Prizm — answers with receipts',
      ]}
      footer={
        <>$0 today · Card required · Cancel anytime · 21+</>
      }
    >
      <motion.div
        initial="hidden"
        animate="visible"
        transition={{ staggerChildren: 0.06 }}
        className="mx-auto w-full max-w-[400px]"
      >
        <motion.h1 variants={rise} className="font-display text-[28px] font-semibold tracking-[-0.01em] text-text-1">
          Start your 7-day free trial.
        </motion.h1>
        <motion.p variants={rise} className="mt-2 text-sm text-text-2">
          Full access from minute one. $0 today.
        </motion.p>

        <motion.form variants={rise} onSubmit={submit} noValidate className="mt-7 space-y-5">
          <motion.div variants={rise} className="space-y-5">
            {/* Plan picker */}
            <fieldset>
              <legend className="overline-caption mb-2 text-text-3">Plan</legend>
              <div className="grid grid-cols-2 gap-2">
                {PLANS.map((p) => {
                  const active = planId === p.id
                  return (
                    <label
                      key={p.id}
                      className={`relative cursor-pointer rounded-md border px-3.5 py-3 transition-colors ${
                        active ? 'border-sp-indigo bg-sp-indigo/10' : 'border-line bg-bg-2 hover:border-line-strong'
                      }`}
                    >
                      <input
                        type="radio"
                        name="plan"
                        value={p.id}
                        checked={active}
                        onChange={() => setPlanId(p.id)}
                        className="sr-only"
                      />
                      {active && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                          className="absolute right-2.5 top-2.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-sp-indigo text-white"
                        >
                          <Check size={11} strokeWidth={3} />
                        </motion.span>
                      )}
                      <span className="block text-sm font-semibold text-text-1">{p.name}</span>
                      <span className="data-mono mt-0.5 block text-[12px] text-text-3">
                        ${cadence === 'monthly' ? p.monthly.toFixed(2) + '/mo' : p.annual.toFixed(2) + '/yr'}
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            {/* Cadence */}
            <fieldset>
              <legend className="overline-caption mb-2 text-text-3">Billing</legend>
              <div className="grid grid-cols-2 gap-2">
                {(['monthly', 'annual'] as const).map((c) => {
                  const active = cadence === c
                  return (
                    <label
                      key={c}
                      className={`relative cursor-pointer rounded-md border px-3.5 py-2.5 text-center transition-colors ${
                        active ? 'border-sp-indigo bg-sp-indigo/10' : 'border-line bg-bg-2 hover:border-line-strong'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cadence"
                        value={c}
                        checked={active}
                        onChange={() => setCadence(c)}
                        className="sr-only"
                      />
                      <span className="block text-sm font-medium capitalize text-text-1">{c}</span>
                      {c === 'annual' && (
                        <span className="data-mono mt-0.5 inline-block rounded-sm bg-sp-amber/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-sp-amber">
                          2 months free
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            </fieldset>

            {/* Name */}
            <div>
              <label htmlFor="reg-name" className="overline-caption mb-2 block text-text-3">
                Full name
              </label>
              <input
                id="reg-name"
                type="text"
                autoComplete="name"
                placeholder="Marcus Sharp"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (errors.name) setErrors((p) => ({ ...p, name: false }))
                }}
                className={inputClass(!!errors.name)}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="reg-email" className="overline-caption mb-2 block text-text-3">
                Email
              </label>
              <input
                id="reg-email"
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

            {/* Password + strength meter */}
            <div>
              <label htmlFor="reg-password" className="overline-caption mb-2 block text-text-3">
                Password
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="6+ characters"
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
              <div className="mt-2.5 flex items-center gap-2">
                <div className="flex flex-1 gap-1.5">
                  {[0, 1, 2].map((i) => {
                    const filled = score > i
                    const spectrumFill = score === 3
                    return (
                      <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-bg-3">
                        <motion.span
                          className="block h-full w-full origin-left rounded-full"
                          style={{
                            background: spectrumFill ? 'var(--gradient-spectrum)' : 'var(--sp-indigo)',
                          }}
                          initial={false}
                          animate={{ scaleX: filled ? 1 : 0 }}
                          transition={{ duration: 0.2, delay: i * 0.06, ease: EASE }}
                        />
                      </span>
                    )
                  })}
                </div>
                <span className="data-mono w-12 text-right text-[11px] text-text-3">
                  {score > 0 ? STRENGTH_LABELS[score - 1] : ''}
                </span>
              </div>
              {errors.password && <p className="mt-1.5 text-[13px] text-danger">Use at least 6 characters.</p>}
            </div>

            {/* Affiliate code */}
            <div>
              <label htmlFor="reg-affiliate" className="overline-caption mb-2 block text-text-3">
                Affiliate code <span className="normal-case tracking-normal text-text-3">(optional)</span>
              </label>
              <div className="relative">
                <input
                  id="reg-affiliate"
                  type="text"
                  placeholder="e.g. SHARP26"
                  value={affiliate}
                  onChange={(e) => setAffiliate(e.target.value.toUpperCase())}
                  className={`${inputClass(false, true)} pr-11`}
                />
                {affiliateValid && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-success/20 text-success"
                  >
                    <Check size={12} strokeWidth={3} />
                  </motion.span>
                )}
              </div>
              <p className={`mt-1.5 text-[13px] ${affiliateValid ? 'text-success' : 'text-text-3'}`}>
                {affiliateValid ? 'Code applied — nice.' : 'Have a code? It supports your favorite creator.'}
              </p>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3">
              <label className="flex cursor-pointer items-start gap-3 text-sm text-text-2">
                <Checkbox
                  checked={terms}
                  onCheckedChange={(v) => {
                    setTerms(v === true)
                    if (errors.terms) setErrors((p) => ({ ...p, terms: false }))
                  }}
                  aria-label="Agree to Terms and Privacy Policy"
                  className={`mt-0.5 ${errors.terms ? 'border-danger' : ''}`}
                />
                <span>
                  I agree to the{' '}
                  <Link to="/terms" className="text-sp-indigo hover:brightness-125">
                    Terms
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="text-sp-indigo hover:brightness-125">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              {errors.terms && <p className="text-[13px] text-danger">Please accept the terms to continue.</p>}
              <label className="flex cursor-pointer items-start gap-3 text-sm text-text-2">
                <Checkbox
                  checked={marketing}
                  onCheckedChange={(v) => setMarketing(v === true)}
                  aria-label="Receive marketing emails"
                  className="mt-0.5"
                />
                <span>Email me sharp research, product updates, and occasional offers.</span>
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={phase !== 'idle'}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-sp-indigo text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 hover:shadow-cta-glow active:scale-[0.97] disabled:opacity-90"
            >
              {phase === 'loading' && <Loader2 size={18} className="animate-spin" aria-label="Starting trial" />}
              {phase === 'done' && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
                  <Check size={18} strokeWidth={3} aria-label="Trial started" />
                </motion.span>
              )}
              {phase === 'idle' && <>Start free trial — {selectedPlan.name}</>}
            </button>

            {/* Legal micro */}
            <p className="text-center text-xs leading-relaxed text-text-3">
              By starting you agree to the{' '}
              <Link to="/terms" className="text-sp-indigo hover:brightness-125">
                Terms
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-sp-indigo hover:brightness-125">
                Privacy Policy
              </Link>
              . $0 today; then {priceLabel} after day 8. Cancel anytime.
            </p>
          </motion.div>
        </motion.form>

        <motion.p variants={rise} className="mt-6 text-center text-sm text-text-2">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-sp-indigo transition hover:brightness-125">
            Sign in
          </Link>
        </motion.p>
      </motion.div>
    </AuthSplit>
  )
}
