import { useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const STEPS = [
  {
    num: '01',
    title: 'Dashboards',
    headline: 'Read the colors',
    body: 'Rolling splits vs season baseline, heat-coded red (edge) to blue (fade). The table is the take.',
    shot: '/shot-dashboard.png',
    alt: 'Prizm MLB dashboard split table with red and blue heat-coded cells',
  },
  {
    num: '02',
    title: 'Hit Rates',
    headline: 'Scan the slate',
    body: 'L5/L10/L20 hit rates for every prop market, flagged when the price is wrong.',
    shot: '/shot-hitrates.png',
    alt: 'Prizm hit-rate scanner with L5 L10 L20 bars and price alert flags',
  },
  {
    num: '03',
    title: 'Ask Prizm',
    headline: 'Ask anything',
    body: 'Ask Prizm answers in plain English, with the receipts — tables included.',
    shot: '/shot-ask.png',
    alt: 'Ask Prizm AI chat answering with an embedded stat table',
  },
]

export default function Showcase() {
  const root = useRef<HTMLDivElement>(null)
  const fill = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  useGSAP(
    () => {
      ScrollTrigger.create({
        trigger: root.current,
        start: 'top top',
        end: '+=200%',
        pin: true,
        scrub: true,
        onUpdate: (self) => {
          const step = Math.min(2, Math.floor(self.progress * 3))
          setActive((prev) => (prev === step ? prev : step))
          if (fill.current) {
            gsap.set(fill.current, { scaleY: self.progress, transformOrigin: 'top center' })
          }
        },
      })
    },
    { scope: root },
  )

  return (
    <section ref={root} id="showcase" className="relative overflow-hidden bg-bg-0">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-12 px-6 py-24 lg:grid-cols-[40%_60%] lg:py-0 lg:h-[100dvh]">
        {/* Progress rail */}
        <div className="absolute left-4 top-1/2 hidden h-48 w-[3px] -translate-y-1/2 rounded-full bg-bg-3 lg:block">
          <div ref={fill} className="h-full w-full rounded-full" style={{ background: 'var(--gradient-spectrum)', transform: 'scaleY(0)' }} />
        </div>

        {/* Left: step list */}
        <div className="relative pl-2 lg:pl-10">
          {STEPS.map((s, i) => (
            <div
              key={s.num}
              className="border-l-2 py-6 pl-6 transition-all duration-500 first:pt-0 last:pb-0"
              style={{
                borderColor: i === active ? 'var(--sp-indigo)' : 'var(--line)',
                opacity: i === active ? 1 : 0.3,
                transform: i === active ? 'translateY(0)' : 'translateY(6px)',
              }}
            >
              <span className="data-mono text-sm text-sp-indigo">{s.num}</span>
              <h3 className="font-display mt-1 text-2xl font-semibold text-text-1">
                <span className="text-text-3">{s.title} — </span>
                {s.headline}
              </h3>
              <p className="mt-2 max-w-md text-[15px] leading-relaxed text-text-2">{s.body}</p>
            </div>
          ))}
        </div>

        {/* Right: device-frame browser mock with crossfading screenshots */}
        <div className="rounded-lg border border-line bg-bg-1 p-2 shadow-raised">
          <div className="flex items-center gap-1.5 rounded-t-md bg-bg-2 px-3 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-bg-3" />
            <span className="h-2.5 w-2.5 rounded-full bg-bg-3" />
            <span className="h-2.5 w-2.5 rounded-full bg-bg-3" />
            <span className="data-mono ml-3 rounded-sm bg-bg-1 px-2 py-0.5 text-[10px] text-text-3">
              prizm.app/{STEPS[active].title.toLowerCase().replace(' ', '')}
            </span>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-b-md">
            {STEPS.map((s, i) => (
              <img
                key={s.num}
                src={s.shot}
                alt={s.alt}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-all duration-500"
                style={{
                  opacity: i === active ? 1 : 0,
                  transform: i === active ? 'scale(1)' : 'scale(1.03)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
