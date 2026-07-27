import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Menu, X, ArrowRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const PRODUCT_LINKS = [
  { label: 'Dashboards', to: '/dashboard', desc: 'MLB & NHL split tables' },
  { label: 'Hit Rates', to: '/hit-rates', desc: 'L5/L10/L20 prop scanner' },
  { label: 'Profiler', to: '/profiler', desc: 'Player deep dives' },
  { label: 'GameCenter', to: '/gamecenter', desc: 'Matchup breakdowns' },
  { label: 'EdgeCenter', to: '/edgecenter', desc: 'Daily edge report' },
  { label: 'Ask Prizm', to: '/ask', desc: 'AI answers with receipts' },
  { label: 'My Angles', to: '/angles', desc: 'Your saved research' },
]

const NAV_LINKS = [
  { label: 'Pricing', to: '/pricing' },
  { label: 'FAQ', to: '/faq' },
]

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [productOpen, setProductOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, isAuthenticated } = useAuth()
  const signedIn = isAuthenticated && !!user
  const location = useLocation()
  // Tracks whether the dropdown was opened by the hover that precedes a click.
  // Without this, the first click after load fires right after mouseenter and
  // toggles the just-opened menu back closed (audit: "first click ignored").
  const productOpenRef = useRef(false)
  const hoverOpened = useRef(false)
  useEffect(() => {
    productOpenRef.current = productOpen
  }, [productOpen])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    setProductOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  return (
    <>
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50 h-[72px] border-b backdrop-blur-[16px] transition-colors duration-200"
      style={{
        backgroundColor: scrolled ? 'rgba(7,8,15,0.85)' : 'rgba(7,8,15,0.70)',
        borderColor: scrolled ? 'var(--line)' : 'transparent',
      }}
    >
      <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3" aria-label="Prizm home">
          <img src="/logo.svg" alt="" className="h-7 w-auto" />
          <span className="font-display text-[15px] font-bold tracking-[0.28em] text-text-1">
            PRIZM
          </span>
        </Link>

        {/* Center links */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          <div
            className="relative"
            onMouseEnter={() => {
              if (!productOpenRef.current) hoverOpened.current = true
              setProductOpen(true)
            }}
            onMouseLeave={() => {
              hoverOpened.current = false
              setProductOpen(false)
            }}
          >
            <button
              type="button"
              className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-text-2 transition-colors hover:text-text-1"
              aria-expanded={productOpen}
              onClick={() => {
                if (hoverOpened.current) {
                  // Click immediately following a hover-open: keep the menu open
                  // (the hover already satisfied this click); next click closes.
                  hoverOpened.current = false
                  return
                }
                setProductOpen((v) => !v)
              }}
            >
              Product
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${productOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <AnimatePresence>
              {productOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18 }}
                  className="absolute left-1/2 top-full w-[300px] -translate-x-1/2 pt-2"
                >
                  <div className="rounded-lg border border-line bg-bg-2 p-2 raised">
                    {PRODUCT_LINKS.map((l) => (
                      <Link
                        key={l.label}
                        to={l.to}
                        className="block rounded-md px-3 py-2 transition-colors hover:bg-bg-3"
                      >
                        <span className="block text-sm font-medium text-text-1">{l.label}</span>
                        <span className="block text-xs text-text-3">{l.desc}</span>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-text-2 transition-colors hover:text-text-1"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="hidden items-center gap-3 lg:flex">
          {signedIn ? (
            <>
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-2 text-xs font-semibold text-text-1 ring-2 ring-transparent"
                style={{
                  background: 'linear-gradient(var(--bg-2), var(--bg-2)) padding-box, var(--gradient-spectrum) border-box',
                  border: '2px solid transparent',
                }}
                aria-label={user.name ?? 'Account'}
              >
                {initials(user.name ?? 'Prizm User')}
              </div>
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 rounded-md bg-sp-indigo px-5 py-[11px] text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 hover:shadow-cta-glow active:scale-[0.97]"
              >
                Open app <ArrowRight size={14} />
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-md px-4 py-2.5 text-sm font-medium text-text-1 transition-colors hover:bg-bg-2"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="rounded-md bg-sp-indigo px-5 py-[11px] text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 hover:shadow-cta-glow active:scale-[0.97]"
              >
                Start free trial
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="rounded-md p-2 text-text-1 lg:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </motion.header>

      {/* Mobile full-screen overlay — rendered as a sibling of <header> (not
          inside it) because the header's backdrop-blur makes it a containing
          block for fixed descendants, which clipped this overlay to the nav
          height and made every link unreachable. */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 top-[72px] z-40 flex flex-col overflow-y-auto bg-bg-0 px-6 pb-10 pt-6 lg:hidden"
          >
            <span className="overline-caption mb-3 text-text-3">Product</span>
            {PRODUCT_LINKS.map((l, i) => (
              <motion.div
                key={l.label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.06 * i, duration: 0.3 }}
              >
                <Link
                  to={l.to}
                  className="flex items-center justify-between border-b border-line py-3.5 font-display text-xl font-semibold text-text-1"
                >
                  {l.label}
                  <ArrowRight size={16} className="text-text-3" />
                </Link>
              </motion.div>
            ))}
            <div className="mt-6 flex flex-col gap-3">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.label}
                  to={l.to}
                  className="rounded-md bg-bg-2 px-4 py-3 text-center text-sm font-medium text-text-1"
                >
                  {l.label}
                </Link>
              ))}
              {signedIn ? (
                <Link
                  to="/dashboard"
                  className="rounded-md bg-sp-indigo px-4 py-3 text-center text-sm font-semibold text-white"
                >
                  Open app →
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="rounded-md border border-line bg-bg-2 px-4 py-3 text-center text-sm font-medium text-text-1"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="rounded-md bg-sp-indigo px-4 py-3 text-center text-sm font-semibold text-white"
                  >
                    Start free trial
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
