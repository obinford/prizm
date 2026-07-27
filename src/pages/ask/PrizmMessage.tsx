import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Bookmark, Sparkles } from 'lucide-react'
import type { AskResponse } from '@/data/askResponses'
import { saveAngle } from '../gamecenter/utils'
import MiniTable from './MiniTable'

export interface ChatMessage {
  id: string
  role: 'user' | 'prizm'
  text: string
  response?: AskResponse
  /** pre-completed messages (history threads) skip typing/streaming */
  settled?: boolean
}

const TYPING_VERBS = ['Refracting the data…', 'Scanning windows…', 'Checking prices…']

/** Prism mark avatar used for Prizm answers + typing state. */
export function PrismMark({ size = 26 }: { size?: number }) {
  return (
    <img
      src="/favicon.svg"
      alt=""
      className="shrink-0"
      style={{ width: size, height: size }}
    />
  )
}

function TypingIndicator() {
  const [verbIdx, setVerbIdx] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setVerbIdx((i) => (i + 1) % TYPING_VERBS.length), 620)
    return () => clearInterval(iv)
  }, [])
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.48, repeat: Infinity, delay: i * 0.16 }}
            className="h-1.5 w-1.5 rounded-full bg-sp-indigo"
          />
        ))}
      </div>
      <span
        className="data-mono animate-shimmer bg-clip-text text-[11px] text-transparent"
        style={{
          backgroundImage:
            'linear-gradient(90deg, var(--text-3) 0%, var(--text-1) 50%, var(--text-3) 100%)',
          backgroundSize: '400px 100%',
        }}
      >
        {TYPING_VERBS[verbIdx]}
      </span>
    </div>
  )
}

/** Bold the lead sentence once the answer is fully streamed. */
function FormattedAnswer({ text }: { text: string }) {
  const idx = text.indexOf('. ')
  if (idx === -1 || idx > 140) return <>{text}</>
  return (
    <>
      <strong className="font-semibold text-text-1">{text.slice(0, idx + 1)}</strong>
      {text.slice(idx + 1)}
    </>
  )
}

export function UserBubble({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex justify-end"
    >
      <div className="max-w-[85%] rounded-lg rounded-br-[2px] bg-bg-3 px-4 py-3 text-[15px] leading-relaxed text-text-1">
        {text}
      </div>
    </motion.div>
  )
}

export default function PrizmMessage({
  msg,
  onFollowup,
  onProgress,
}: {
  msg: ChatMessage
  onFollowup: (q: string) => void
  onProgress?: () => void
}) {
  const resp = msg.response!
  const words = useMemo(() => resp.answer.split(' '), [resp])
  const [phase, setPhase] = useState<'typing' | 'streaming' | 'done'>(
    msg.settled ? 'done' : 'typing',
  )
  const [shown, setShown] = useState(msg.settled ? words.length : 0)

  // Typing → streaming
  useEffect(() => {
    if (msg.settled) return
    const t = window.setTimeout(() => setPhase('streaming'), 700)
    return () => window.clearTimeout(t)
  }, [msg.settled])

  // Word-by-word stream, 30ms/word
  useEffect(() => {
    if (phase !== 'streaming') return
    let count = shown
    const iv = window.setInterval(() => {
      count += 1
      setShown(count)
      onProgress?.()
      if (count >= words.length) {
        window.clearInterval(iv)
        setPhase('done')
      }
    }, 30)
    return () => window.clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, words.length])

  const streamedText = words.slice(0, shown).join(' ')

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="group flex items-start gap-3"
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-bg-1">
        <PrismMark size={20} />
      </div>
      <div className="min-w-0 flex-1">
        {phase === 'typing' && <TypingIndicator />}
        {phase !== 'typing' && (
          <>
            <p className="text-[15px] leading-relaxed text-text-2">
              {phase === 'done' ? <FormattedAnswer text={resp.answer} /> : streamedText}
              {phase === 'streaming' && <span className="animate-caret-blink text-sp-indigo">▍</span>}
            </p>
            {phase === 'done' && (
              <>
                {resp.table && <MiniTable table={resp.table} />}
                {/* Follow-up suggestion chips */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
                    onClick={() => onFollowup(`${msg.text} — home games only`)}
                    className="rounded-sm border border-line bg-bg-2 px-2.5 py-1.5 text-[12px] font-medium text-text-2 transition-colors hover:border-line-strong hover:bg-bg-3 hover:text-text-1"
                  >
                    Compare home only
                  </motion.button>
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, delay: 0.18, ease: [0.34, 1.56, 0.64, 1] }}
                    onClick={() =>
                      saveAngle({
                        title: msg.text,
                        subtitle: resp.answer.slice(0, 120) + '…',
                        source: 'Ask Prizm',
                      })
                    }
                    className="flex items-center gap-1.5 rounded-sm border border-line bg-bg-2 px-2.5 py-1.5 text-[12px] font-medium text-text-2 transition-colors hover:border-line-strong hover:bg-bg-3 hover:text-text-1"
                  >
                    <Bookmark size={12} /> Save to angle
                  </motion.button>
                  <span className="data-mono ml-1 hidden items-center gap-1 text-[10px] text-text-3 sm:flex">
                    <Sparkles size={10} /> Sources: {resp.sources.join(' · ')}
                  </span>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}
