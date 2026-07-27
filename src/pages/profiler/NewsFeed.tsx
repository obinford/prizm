// Profiler S3d — News timeline: player items first, team/sport fallbacks.
// Injury tags in amber; date mono, source chip, relevance tag chip.

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Newspaper } from 'lucide-react'
import { NEWS, type NewsItem } from '@/data/news'
import type { AnyPlayer } from '@/pages/profiler/derive'

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

const TAG_CLS: Record<NewsItem['tag'], string> = {
  Injury: 'bg-warning/15 text-warning border-warning/30',
  Lineup: 'bg-sp-cyan/10 text-sp-cyan border-sp-cyan/25',
  Form: 'bg-pos/10 text-[#FCA5A5] border-pos/25',
  Weather: 'bg-info/10 text-info border-info/25',
  Transaction: 'bg-sp-violet/10 text-sp-violet border-sp-violet/25',
  Matchup: 'bg-sp-indigo/10 text-sp-indigo border-sp-indigo/25',
}

function sourceChip(n: NewsItem): string {
  return n.sport === 'mlb' ? 'MLB Wire' : 'NHL Wire'
}

export default function NewsFeed({ player }: { player: AnyPlayer }) {
  const items = useMemo(() => {
    const mine = NEWS.filter((n) => n.playerId === player.id)
    const team = NEWS.filter((n) => n.playerId !== player.id && n.sport === player.sport && n.team === player.team)
    const sport = NEWS.filter(
      (n) => n.playerId !== player.id && n.sport === player.sport && n.team !== player.team,
    )
    return [...mine, ...team, ...sport].slice(0, 8)
  }, [player])

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-bg-1 px-6 py-14 text-center">
        <Newspaper size={28} strokeWidth={1.5} className="text-text-3" />
        <p className="text-sm text-text-2">No news on this player right now.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-line bg-bg-1">
      {items.map((n, i) => (
        <motion.article
          key={n.id}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: i * 0.06, ease: EASE }}
          className="flex gap-4 border-b border-line px-5 py-4 last:border-b-0"
        >
          <div className="w-14 shrink-0 pt-0.5">
            <span className="data-mono text-[11px] text-text-3">{n.time}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm bg-bg-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-3">
                {sourceChip(n)}
              </span>
              <span className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TAG_CLS[n.tag]}`}>
                {n.tag}
              </span>
              {n.player && n.playerId !== player.id && (
                <span className="text-[11px] text-text-3">{n.player}</span>
              )}
            </div>
            <h4 className="mt-1.5 text-sm font-semibold leading-snug text-text-1">{n.title}</h4>
            <p className="mt-1 line-clamp-1 text-[13px] text-text-2">{n.body}</p>
          </div>
        </motion.article>
      ))}
    </div>
  )
}
