import { useEffect, useMemo, useState } from 'react'
import { canStepSlateDay, SLATE_DAY_LABEL, stepSlateDay, useSlateDay } from '@/lib/slateDay'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { BarChart3, Bookmark, Bell, BookOpen, ChevronLeft, ChevronRight, Database, LayoutDashboard, Loader2, LogOut, Menu, Moon, Search, Sun, UserRound, X, Zap } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { LOGIN_PATH } from '@/const'
import { trpc } from '@/providers/trpc'
import LiveDataProvider from '@/providers/LiveDataProvider'
import UserDataSync from '@/providers/UserDataSync'
import { getPlan, onPlanChange, type Plan } from '@/lib/plan'

const RESEARCH_NAV = [
  { label: 'Dashboards — MLB', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Hockey — NHL', to: '/dashboard/hockey', icon: Zap },
  { label: 'Player Profiler', to: '/profiler', icon: UserRound },
  { label: 'Glossary', to: '/glossary', icon: BookOpen },
]

const AI_NAV = [
  { label: 'My Angles', to: '/angles', icon: Bookmark },
]

const PAGE_TITLES: [RegExp, string][] = [
  [/^\/dashboard\/hockey/, 'Hockey Dashboards — NHL'],
  [/^\/dashboard/, 'Dashboards — MLB'],
  [/^\/hit-rates/, 'Hit Rates'],
  [/^\/profiler/, 'Player Profiler'],
  [/^\/gamecenter/, 'GameCenter'],
  [/^\/edgecenter/, 'EdgeCenter'],
  [/^\/angles/, 'My Angles'],
  [/^\/glossary/, 'Glossary'],
]

function pageTitle(pathname: string): string {
  for (const [re, title] of PAGE_TITLES) if (re.test(pathname)) return title
  return 'Prizm'
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

function applyTheme(theme: 'dark' | 'light') {
  document.documentElement.classList.toggle('light', theme === 'light')
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('prizm_theme') as 'dark' | 'light') || 'dark'
  })
  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('prizm_theme', theme)
  }, [theme])
  return (
    <button
      type="button"
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
      {!collapsed && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  )
}

/** Ingestion freshness — latest successful ingest run across all sources. */
function FreshnessChip() {
  const runs = trpc.ingest.lastRuns.useQuery(undefined, {
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: false,
  })
  const latest = useMemo(() => {
    if (!runs.data) return null
    const stamps = Object.values(runs.data)
      .map((r) => r.finishedAt ?? r.startedAt)
      .filter((t): t is number => typeof t === 'number' && Number.isFinite(t))
    return stamps.length ? Math.max(...stamps) : null
  }, [runs.data])
  if (!latest) return null
  return (
    <span
      className="data-mono hidden items-center gap-1.5 rounded-sm border border-line bg-bg-2 px-2 py-1 text-[11px] text-text-3 md:flex"
      title="Latest ingestion run across MLB/NHL/slate/props feeds"
    >
      <Database size={11} className="text-sp-cyan" />
      Data as of {format(new Date(latest), 'MMM d, h:mm a')}
    </span>
  )
}

interface ShellUser {
  name: string
  email: string
  plan: Plan
}

function SidebarContent({ collapsed, user, onLogout, onNavigate }: { collapsed: boolean; user: ShellUser; onLogout: () => void; onNavigate?: () => void }) {
  const navigate = useNavigate()
  const itemCls = (active: boolean) =>
    `relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      active ? 'bg-bg-3 text-text-1' : 'text-text-2 hover:bg-bg-3/60 hover:text-text-1'
    }`

  const renderItem = (item: (typeof RESEARCH_NAV)[number] & { chip?: string }) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === '/dashboard'}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) => itemCls(isActive)}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full"
              style={{ background: 'var(--gradient-spectrum)' }}
            />
          )}
          <item.icon size={18} strokeWidth={1.5} className="shrink-0" />
          {!collapsed && <span className="truncate">{item.label}</span>}
          {!collapsed && item.chip && (
            <span className="ml-auto rounded-sm bg-sp-indigo/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-sp-cyan">
              {item.chip}
            </span>
          )}
        </>
      )}
    </NavLink>
  )

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-line px-4">
        <img src="/favicon.svg" alt="" className="h-7 w-7" />
        {!collapsed && (
          <span className="font-display text-[14px] font-bold tracking-[0.28em] text-text-1">PRIZM</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4" aria-label="App">
        {!collapsed && <p className="overline-caption px-3 pb-2 text-text-3">Research</p>}
        {RESEARCH_NAV.map(renderItem)}
        {!collapsed && <p className="overline-caption px-3 pb-2 pt-5 text-text-3">AI &amp; Saved</p>}
        {collapsed && <div className="my-3 border-t border-line" />}
        {AI_NAV.map(renderItem)}
      </nav>

      {/* Bottom: theme, plan, user */}
      <div className="border-t border-line px-2 py-3">
        <ThemeToggle collapsed={collapsed} />
        <div className={`mt-1 ${collapsed ? 'px-1' : 'px-1'}`}>
          {user.plan === 'allaccess' ? (
            <span
              className="inline-flex items-center rounded-sm px-2 py-1 text-[11px] font-semibold text-white"
              style={{ background: 'var(--gradient-spectrum)' }}
              title="All Access plan"
            >
              {collapsed ? 'AA' : 'All Access'}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-sm bg-sp-indigo/25 px-2 py-1 text-[11px] font-semibold text-sp-indigo" title="Dashboards plan">
              {collapsed ? 'DB' : 'Dashboards'}
            </span>
          )}
        </div>
        <div className="group relative mt-2">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-bg-3"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-text-1"
              style={{
                background: 'linear-gradient(var(--bg-2), var(--bg-2)) padding-box, var(--gradient-spectrum) border-box',
                border: '2px solid transparent',
              }}
            >
              {initials(user.name)}
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text-1">{user.name}</span>
                  <span className="block truncate text-xs text-text-3">{user.email}</span>
                </span>
                <BarChart3 size={14} className="text-text-3" />
              </>
            )}
          </button>
          {/* User menu popover */}
          <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 w-48 rounded-lg border border-line bg-bg-2 p-1 opacity-0 shadow-raised transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
              onClick={() => navigate('/angles')}
            >
              <UserRound size={15} /> Settings
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
              onClick={onLogout}
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Full-screen auth bootstrap while the Kimi session is being verified. */
function AuthLoadingState() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center gap-2 bg-bg-0 text-sm text-text-2">
      <Loader2 size={15} className="animate-spin text-sp-indigo" />
      Verifying your session…
    </div>
  )
}

const TRIAL_DAYS = 7

/**
 * Today / Tomorrow stepper. Previously three inert elements with no handlers —
 * it rendered the literal string "Today" and neither chevron did anything.
 *
 * FIX 9 (option b — scoped): the stepper only moves the surfaces that read
 * useSlateDay() — the Gamecenter and Weather tabs. It does NOT move the prop
 * board (Edgecenter, Hit Rates) or the player tables: props.list serves the
 * latest priced sv_odds date regardless. A control that looks like it filters
 * and silently does not is worse than no control, so outside those two tabs
 * the stepper disables and says why. (Threading a date through props.list
 * stays on the table, but sv_odds only ever holds dates ≤ today — Tomorrow
 * would be a permanently empty board.)
 */
function SlateStepper() {
  const day = useSlateDay()
  const { pathname, search } = useLocation()
  const params = new URLSearchParams(search)
  const tab = params.get('tab') ?? 'gamecenter'
  const view = params.get('view')
  const appliesHere =
    pathname === '/dashboard' &&
    view !== 'hitrates' &&
    (tab === 'gamecenter' || tab === 'weather')
  const disabledTip =
    'Shows Gamecenter and Weather for Today / Tomorrow. The prop board and player tables always show the latest priced slate — the stepper does not move them.'
  return (
    <div
      className={`ml-2 hidden items-center gap-1 rounded-md border border-line bg-bg-2 px-2 py-1.5 sm:flex ${
        appliesHere ? '' : 'opacity-50'
      }`}
      title={appliesHere ? undefined : disabledTip}
      aria-disabled={!appliesHere}
    >
      <button
        type="button"
        onClick={() => stepSlateDay(-1)}
        disabled={!appliesHere || !canStepSlateDay(-1)}
        className="text-text-3 transition-colors hover:text-text-1 disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Previous day"
      >
        <ChevronLeft size={14} />
      </button>
      <span className="data-mono px-1 text-xs text-text-2">{SLATE_DAY_LABEL[day]}</span>
      <button
        type="button"
        onClick={() => stepSlateDay(1)}
        disabled={!appliesHere || !canStepSlateDay(1)}
        className="text-text-3 transition-colors hover:text-text-1 disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Next day"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

export default function AppShell() {
  const location = useLocation()
  const { user, isLoading, logout } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: LOGIN_PATH,
  })
  const [plan, setPlan] = useState<Plan>(() => getPlan())
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => onPlanChange(() => setPlan(getPlan())), [])
  useEffect(() => setDrawerOpen(false), [location.pathname])

  const title = useMemo(() => pageTitle(location.pathname), [location.pathname])

  // 7-day trial runs from account creation (OAuth auto-provisions the user).
  const daysLeft = useMemo(() => {
    if (!user?.createdAt) return 0
    const created = new Date(user.createdAt).getTime()
    const ms = created + TRIAL_DAYS * 86_400_000 - Date.now()
    return Math.max(0, Math.ceil(ms / 86_400_000))
  }, [user?.createdAt])
  const inTrial = daysLeft > 0

  // Auto-collapse sidebar below 1024px
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const effectiveCollapsed = collapsed || narrow

  // Auth gate — all app routes require a Kimi OAuth session. useAuth redirects
  // unauthenticated visitors to LOGIN_PATH; render nothing while that happens.
  if (isLoading) return <AuthLoadingState />
  if (!user) return null

  const shellUser: ShellUser = {
    name: user.name?.trim() || 'Prizm User',
    email: user.email ?? '',
    plan,
  }

  return (
    <LiveDataProvider>
      <UserDataSync />
      <div className="flex min-h-[100dvh] bg-bg-0">
        {/* Sidebar — desktop (collapses to 64px at <1024px or when toggled) */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 hidden border-r border-line bg-bg-1 transition-[width] duration-300 md:block ${
            effectiveCollapsed ? 'w-16' : 'w-60'
          }`}
        >
          <SidebarContent collapsed={effectiveCollapsed} user={shellUser} onLogout={logout} />
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="absolute -right-3 top-20 hidden h-6 w-6 items-center justify-center rounded-full border border-line bg-bg-2 text-text-2 transition-colors hover:text-text-1 lg:flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </aside>

        {/* Mobile off-canvas drawer */}
        <AnimatePresence>
          {drawerOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-[rgba(4,5,12,0.7)] backdrop-blur-[8px] md:hidden"
                onClick={() => setDrawerOpen(false)}
              />
              <motion.aside
                initial={{ x: -260 }}
                animate={{ x: 0 }}
                exit={{ x: -260 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-y-0 left-0 z-50 w-60 border-r border-line bg-bg-1 md:hidden"
              >
                <button
                  type="button"
                  className="absolute right-3 top-5 text-text-2"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
                <SidebarContent collapsed={false} user={shellUser} onLogout={logout} onNavigate={() => setDrawerOpen(false)} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main column */}
        <div
          className={`flex min-w-0 flex-1 flex-col transition-[margin] duration-300 ${
            effectiveCollapsed ? 'md:ml-16' : 'md:ml-60'
          }`}
        >
          {/* Topbar */}
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg-0/80 px-4 backdrop-blur-[16px] md:px-8">
            <button
              type="button"
              className="flex min-h-10 min-w-10 items-center justify-center rounded-md p-2 text-text-1 md:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <h1 className="font-display text-xl font-semibold text-text-1">{title}</h1>

            {/* Slate date picker — Today / Tomorrow, wired to the slateDay store */}
            <SlateStepper />

            <FreshnessChip />

            <div className="flex-1" />

            {/* Global search (cmd-K style) */}
            <button
              type="button"
              className="hidden items-center gap-2 rounded-md border border-line bg-bg-2 px-3 py-2 text-text-3 transition-colors hover:border-line-strong md:flex md:w-56 lg:w-72"
            >
              <Search size={15} />
              <span className="data-mono flex-1 text-left text-xs">Search players…</span>
              <kbd className="data-mono rounded-sm border border-line bg-bg-3 px-1.5 py-0.5 text-[10px]">⌘K</kbd>
            </button>

            {/* Notifications */}
            <button
              type="button"
              className="relative flex min-h-10 min-w-10 items-center justify-center rounded-md p-2 text-text-2 transition-colors hover:bg-bg-2 hover:text-text-1"
              aria-label="Notifications"
            >
              <Bell size={18} strokeWidth={1.5} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-pos" />
            </button>

            {/* Trial badge */}
            {inTrial && (
              <span className="hidden items-center gap-1.5 rounded-sm border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning sm:flex">
                <Zap size={12} />
                Trial · {daysLeft} day{daysLeft === 1 ? '' : 's'} left
              </span>
            )}
          </header>

          {/* Page content */}
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-8 md:py-8"
          >
            <Outlet />
          </motion.main>
        </div>
      </div>
    </LiveDataProvider>
  )
}
