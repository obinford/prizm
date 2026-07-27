import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, Lock, Plus, Sparkles } from 'lucide-react'
import {
  FREE_DAILY_QUERIES,
  getQueryCount,
  incrementQueryCount,
} from '@/data/askResponses'
import { ASK_RESPONSES } from '@/data/askResponses'
import { getPlan } from '@/lib/plan'
import { ToastViewport } from './gamecenter/kit'
import { ASK_SUGGESTED_PROMPTS, resolveAsk } from './ask/extraResponses'
import PrizmMessage, { PrismMark, UserBubble, type ChatMessage } from './ask/PrizmMessage'

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

interface Thread {
  id: string
  title: string
  group: 'Today' | 'Yesterday'
  messages: ChatMessage[]
}

let msgSeq = 1
const nextMsgId = () => `m-${msgSeq++}`

function seedThreads(): Thread[] {
  const judge = ASK_RESPONSES.find((r) => r.id === 'ask-judge-fenway')!
  const goalie = ASK_RESPONSES.find((r) => r.id === 'ask-goalie')!
  return [
    { id: 't-new', title: 'New conversation', group: 'Today', messages: [] },
    {
      id: 't-y1',
      title: 'Judge XBH at Fenway?',
      group: 'Yesterday',
      messages: [
        { id: nextMsgId(), role: 'user', text: judge.question, settled: true },
        { id: nextMsgId(), role: 'prizm', text: judge.question, response: judge, settled: true },
      ],
    },
    {
      id: 't-y2',
      title: 'Goalie saves value',
      group: 'Yesterday',
      messages: [
        { id: nextMsgId(), role: 'user', text: goalie.question, settled: true },
        { id: nextMsgId(), role: 'prizm', text: goalie.question, response: goalie, settled: true },
      ],
    },
  ]
}

// ---------------------------------------------------------------------------
// Empty-state prism mark — perpetual pulse isolated + memoized
// ---------------------------------------------------------------------------

const PulsingMark = memo(function PulsingMark() {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex h-20 w-20 items-center justify-center"
    >
      <motion.span
        animate={{ opacity: [0.25, 0.6, 0.25], scale: [1, 1.12, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-0 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)' }}
      />
      <PrismMark size={48} />
    </motion.div>
  )
})

// ---------------------------------------------------------------------------
// Ask Prizm page
// ---------------------------------------------------------------------------

export default function Ask() {
  const isAllAccess = getPlan() === 'allaccess'

  const [threads, setThreads] = useState<Thread[]>(seedThreads)
  const [activeId, setActiveId] = useState('t-new')
  const [input, setInput] = useState('')
  const [queryCount, setQueryCount] = useState(() => getQueryCount())

  const active = threads.find((t) => t.id === activeId) ?? threads[0]
  const locked = !isAllAccess && queryCount >= FREE_DAILY_QUERIES

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }
  useEffect(scrollToBottom, [active.messages.length, activeId])

  const send = (raw: string) => {
    const q = raw.trim()
    if (!q || locked) return

    const used = incrementQueryCount()
    setQueryCount(used)

    const response = resolveAsk(q)
    const userMsg: ChatMessage = { id: nextMsgId(), role: 'user', text: q }
    const prizmMsg: ChatMessage = { id: nextMsgId(), role: 'prizm', text: q, response }

    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== active.id) return t
        const isFirst = t.messages.length === 0
        return {
          ...t,
          title: isFirst ? (q.length > 30 ? `${q.slice(0, 30)}…` : q) : t.title,
          messages: [...t.messages, userMsg, prizmMsg],
        }
      }),
    )
    setInput('')
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.focus()
    }
  }

  const newChat = () => {
    const existing = threads.find((t) => t.group === 'Today' && t.messages.length === 0)
    if (existing) {
      setActiveId(existing.id)
      return
    }
    const id = `t-${Date.now()}`
    setThreads((prev) => [{ id, title: 'New conversation', group: 'Today' as const, messages: [] }, ...prev])
    setActiveId(id)
  }

  const groups = useMemo(() => {
    const g: Record<'Today' | 'Yesterday', Thread[]> = { Today: [], Yesterday: [] }
    threads.forEach((t) => g[t.group].push(t))
    return g
  }, [threads])

  return (
    <div className="relative">
      {/* Faint radial indigo glow top */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{
          background:
            'radial-gradient(ellipse 60% 100% at 50% 0%, rgba(99,102,241,0.10) 0%, transparent 70%)',
        }}
      />

      <div className="relative flex gap-8">
        {/* S6 — History rail (desktop ≥1280px) */}
        <aside className="hidden w-60 shrink-0 xl:block">
          <button
            type="button"
            onClick={newChat}
            className="mb-5 flex w-full items-center justify-center gap-2 rounded-md border border-line bg-bg-2 px-3 py-2.5 text-sm font-medium text-text-1 transition-colors hover:bg-bg-3"
          >
            <Plus size={15} /> New chat
          </button>
          <nav className="space-y-5" aria-label="Chat history">
            {(['Today', 'Yesterday'] as const).map((g) =>
              groups[g].length > 0 ? (
                <div key={g}>
                  <p className="overline-caption mb-2 text-text-3">{g}</p>
                  <div className="space-y-0.5">
                    {groups[g].map((t) => {
                      const isActive = t.id === active.id
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setActiveId(t.id)}
                          className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors ${
                            isActive ? 'bg-bg-2' : 'hover:bg-bg-2/70'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              isActive ? 'bg-sp-indigo' : 'bg-transparent'
                            }`}
                          />
                          <span className="data-mono truncate text-[12px] text-text-2">
                            {t.title}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null,
            )}
          </nav>
        </aside>

        {/* Chat column */}
        <div className="mx-auto flex h-[calc(100dvh-7rem)] w-full max-w-[800px] flex-1 flex-col md:h-[calc(100dvh-8rem)]">
          {/* S4 — Query meter strip */}
          <div className="flex items-center justify-end gap-3 pb-3">
            {isAllAccess ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-semibold text-white"
                style={{ background: 'var(--gradient-spectrum)' }}
              >
                <Sparkles size={11} /> All Access · Unlimited queries
              </span>
            ) : (
              <div
                className={`flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 ${
                  queryCount === FREE_DAILY_QUERIES - 1 ? 'animate-ring-pulse' : ''
                }`}
              >
                <span className="data-mono text-[12px] font-semibold text-sp-amber">
                  {Math.min(queryCount, FREE_DAILY_QUERIES)} / {FREE_DAILY_QUERIES}
                </span>
                <span className="text-[11px] text-text-3">demo queries used</span>
                <span className="h-1 w-24 overflow-hidden rounded-full bg-bg-3">
                  <motion.span
                    className="block h-full rounded-full bg-sp-amber"
                    initial={false}
                    animate={{
                      width: `${(Math.min(queryCount, FREE_DAILY_QUERIES) / FREE_DAILY_QUERIES) * 100}%`,
                    }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  />
                </span>
              </div>
            )}
          </div>

          {/* Messages scroll area */}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto pr-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {active.messages.length === 0 ? (
                  /* S2 — Empty state */
                  <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
                    <PulsingMark />
                    <h2 className="mt-5 font-display text-2xl font-semibold text-text-1">
                      Ask <span className="text-spectrum">Prizm</span> anything.
                    </h2>
                    <p className="mt-2 text-sm text-text-2">Plain English in. Tables out.</p>
                    <div className="mt-8 grid w-full max-w-[640px] grid-cols-1 gap-3 sm:grid-cols-2">
                      {ASK_SUGGESTED_PROMPTS.map((p, i) => (
                        <motion.button
                          key={p}
                          type="button"
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: 0.15 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                          onClick={() => send(p)}
                          className="prizm-card flex items-start gap-2.5 rounded-md p-3.5 text-left transition-all duration-200 hover:-translate-y-[3px] hover:border-sp-indigo/50"
                        >
                          <Sparkles size={14} className="mt-0.5 shrink-0 text-sp-indigo" />
                          <span className="text-[13px] font-medium leading-snug text-text-2">
                            {p}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* S3 — Messages */
                  <div className="space-y-6 py-2">
                    {active.messages.map((m) =>
                      m.role === 'user' ? (
                        <UserBubble key={m.id} text={m.text} />
                      ) : (
                        <PrizmMessage
                          key={m.id}
                          msg={m}
                          onFollowup={send}
                          onProgress={scrollToBottom}
                        />
                      ),
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Locked upgrade card (Dashboards at 5/5) */}
          {!isAllAccess && locked && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="prizm-card raised mb-3 flex flex-wrap items-center gap-4 p-5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sp-indigo/15 text-sp-indigo">
                <Lock size={18} strokeWidth={1.5} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-1">
                  You&apos;ve used all {FREE_DAILY_QUERIES} demo queries.
                </p>
                <p className="mt-0.5 text-[13px] text-text-2">
                  Unlimited Ask Prizm is an All Access feature.
                </p>
              </div>
              <Link
                to="/pricing"
                className="cta-glow rounded-md bg-sp-indigo px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Upgrade
              </Link>
            </motion.div>
          )}

          {/* S5 — Composer */}
          <motion.div
            initial={false}
            className={`rounded-xl border bg-bg-1 p-3 transition-shadow duration-200 focus-within:border-sp-indigo focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.25)] ${
              locked ? 'border-line opacity-60' : 'border-line'
            }`}
          >
            <div className="flex items-end gap-3">
              <textarea
                ref={inputRef}
                value={input}
                disabled={locked}
                onChange={(e) => {
                  setInput(e.target.value)
                  const el = e.target
                  el.style.height = 'auto'
                  el.style.height = `${Math.min(el.scrollHeight, 4 * 24 + 16)}px`
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send(input)
                  }
                }}
                rows={1}
                placeholder={
                  locked ? 'Upgrade to keep asking…' : 'Ask about any player, split, or prop…'
                }
                className="max-h-28 min-h-[24px] flex-1 resize-none bg-transparent text-base leading-6 text-text-1 placeholder:text-text-3 focus:outline-none disabled:cursor-not-allowed md:text-[15px]"
              />
              <span className="data-mono mb-0.5 hidden shrink-0 rounded-sm border border-line bg-bg-2 px-1.5 py-0.5 text-[11px] text-text-3 sm:block">
                Prizm-1
              </span>
              <motion.button
                type="button"
                whileTap={{ rotate: 15, scale: 0.88 }}
                onClick={() => send(input)}
                disabled={!input.trim() || locked}
                aria-label="Send"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                  input.trim() && !locked
                    ? 'bg-sp-indigo text-white hover:brightness-110'
                    : 'bg-bg-3 text-text-3'
                }`}
              >
                <ArrowUp size={17} strokeWidth={2} />
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>

      <ToastViewport />
    </div>
  )
}
