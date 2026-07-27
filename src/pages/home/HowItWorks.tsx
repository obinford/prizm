import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { CalendarDays, Palette, Bookmark } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const STEPS = [
  {
    num: '01',
    icon: CalendarDays,
    title: "Pick tonight's slate",
    body: 'Date picker, every game, every starter. The board is set before your coffee is.',
  },
  {
    num: '02',
    icon: Palette,
    title: 'Read the colors',
    body: 'Red angles, blue fades, deltas vs baseline. Your eye finds the edge first.',
  },
  {
    num: '03',
    icon: Bookmark,
    title: 'Save the angle',
    body: 'File it to My Angles, share the card, track your thinking over the season.',
  },
]

export default function HowItWorks() {
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      // Beam draws across steps as the section scrolls through
      gsap.fromTo(
        '.hiw-beam',
        { scaleX: 0 },
        {
          scaleX: 1,
          transformOrigin: 'left center',
          ease: 'none',
          scrollTrigger: {
            trigger: root.current,
            start: 'top 70%',
            end: 'bottom 60%',
            scrub: true,
          },
        },
      )
      gsap.fromTo(
        '.hiw-step',
        { y: 32, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: { trigger: root.current, start: 'top 75%' },
        },
      )
    },
    { scope: root },
  )

  return (
    <section ref={root} id="how-it-works" className="bg-bg-0 py-[120px] max-lg:py-[72px]">
      <div className="mx-auto max-w-[1200px] px-6">
        <h2 className="font-display text-center font-semibold text-text-1" style={{ fontSize: 'clamp(30px, 4vw, 40px)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          Three steps to the full spectrum
        </h2>

        <div className="relative mt-16">
          {/* Connecting beam */}
          <div className="absolute left-0 right-0 top-6 hidden h-px md:block">
            <div className="hiw-beam h-px w-full" style={{ background: 'var(--gradient-spectrum)', opacity: 0.6 }} />
          </div>

          <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.num} className="hiw-step relative">
                <div className="relative z-10 mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-bg-1">
                  <s.icon size={18} strokeWidth={1.5} className="text-sp-cyan" />
                </div>
                <span className="data-mono text-sm text-sp-indigo">{s.num}</span>
                <h3 className="font-display mt-1 text-2xl font-semibold text-text-1">{s.title}</h3>
                <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-text-2">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
