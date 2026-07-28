import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Play } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const HeroPrism = lazy(() => import('@/pages/home/HeroPrism'))

// Feature descriptors only — this marquee previously carried hardcoded
// per-player stat lines ("JUDGE · L30 SLG .731 · +18%") that were invented
// and froze the day they were written. Rule 1: no fabricated stats, even
// decorative ones. Every item below names a capability, not a number.
const TICKER_ITEMS = [
  'ROLLING WINDOWS · L30 TO L240',
  'DE-VIGGED FAIR ODDS',
  'PARK FACTORS · WEATHER-ADJUSTED',
  'VS L/R PITCHER SPLITS',
  'HOME / AWAY SPLITS',
  'HIT RATES ON EVERY MARKET',
  'CONFIRMED LINEUPS + BATTING ORDER',
  'BULLPEN FATIGUE TRACKING',
]

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const fn = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return reduced
}

function supportsWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

/** Split a headline into char spans for the stagger reveal (≤20 chars/line). */
function SplitLine({
  text,
  className,
  charClassName,
}: {
  text: string
  className?: string
  charClassName?: string
}) {
  return (
    <span className={`inline-block ${className ?? ''}`} aria-label={text}>
      {text.split('').map((ch, i) => (
        <span
          key={i}
          aria-hidden
          className={`hero-char inline-block will-change-transform ${charClassName ?? ''}`}
          style={{ transformOrigin: '50% 100%' }}
        >
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </span>
  )
}

export default function Hero({ onWatchLight }: { onWatchLight: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const visualWrap = useRef<HTMLDivElement>(null)
  const contentWrap = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [webgl] = useState(() => supportsWebGL())
  const useFallback = reduced || !webgl

  useGSAP(
    () => {
      if (reduced) return
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      // Beam draws in, then rays fan out
      tl.fromTo(
        '.hero-beam',
        { scaleX: 0, transformOrigin: 'left center' },
        { scaleX: 1, duration: 0.7 },
        0.15,
      )
        .fromTo(
          '.hero-ray',
          { opacity: 0, scaleX: 0, transformOrigin: 'left center' },
          { opacity: 1, scaleX: 1, duration: 0.5, stagger: 0.08 },
          0.7,
        )
        // Headline char reveal
        .fromTo(
          '.hero-char',
          { y: 24, opacity: 0, rotateX: 60 },
          { y: 0, opacity: 1, rotateX: 0, duration: 0.6, stagger: 0.02 },
          0.9,
        )
        .fromTo(
          '.hero-sub',
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.4 },
          1.5,
        )
        .fromTo(
          '.hero-cta',
          { scale: 0.94, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.7)', stagger: 0.08 },
          1.65,
        )
        .fromTo(
          '.hero-proof',
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.4 },
          1.85,
        )
        .fromTo(
          '.hero-overline-bar',
          { width: 0 },
          { width: '100%', duration: 0.6 },
          0.3,
        )

      // Scroll behavior: content parallaxes up at 0.6×, prism fades to 30% by 80vh
      gsap.to(contentWrap.current, {
        yPercent: -18,
        ease: 'none',
        scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom top', scrub: 0.6 },
      })
      gsap.to(visualWrap.current, {
        opacity: 0.3,
        ease: 'none',
        scrollTrigger: { trigger: root.current, start: 'top top', end: '80% top', scrub: true },
      })
    },
    { scope: root, dependencies: [reduced] },
  )

  return (
    <section
      ref={root}
      className="relative -mt-[72px] flex min-h-[100dvh] min-h-[720px] flex-col overflow-hidden pt-[72px]"
    >
      {/* Background: radial indigo glow + noise */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 60% at 15% 10%, rgba(99,102,241,0.12) 0%, transparent 70%)',
        }}
      />
      <div className="noise-overlay pointer-events-none absolute inset-0" />

      <div className="relative mx-auto grid w-full max-w-[1200px] flex-1 grid-cols-1 items-center gap-10 px-6 py-16 lg:grid-cols-[55%_45%]">
        {/* Left column */}
        <div ref={contentWrap}>
          <div className="hero-proof mb-5">
            <span className="overline-caption text-text-2">MLB + NHL Prop Research</span>
            <div className="mt-2 h-px w-40 bg-bg-3">
              <div className="hero-overline-bar h-px" style={{ background: 'var(--gradient-spectrum)' }} />
            </div>
          </div>

          <h1
            className="font-display font-bold text-text-1"
            style={{ fontSize: 'clamp(42px, 6.3vw, 76px)', lineHeight: 1.02, letterSpacing: '-0.03em' }}
          >
            <SplitLine text="See " />
            {/* Gradient must live on each letter span — background-clip:text on a
                parent is broken by the animated inline-block char spans inside it. */}
            <SplitLine text="every side" charClassName="text-spectrum" />
            <br />
            <SplitLine text="of the bet." />
          </h1>

          <p className="hero-sub mt-6 max-w-[520px] text-lg leading-[1.65] text-text-2">
            Prizm refracts raw MLB &amp; NHL data into the full spectrum of betting angles —
            rolling splits, hit rates, and matchup reads. One dashboard. Zero guesswork.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/register"
              className="hero-cta rounded-md bg-sp-indigo px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 hover:shadow-cta-glow active:scale-[0.97]"
            >
              Start 7-day free trial
            </Link>
            <button
              type="button"
              onClick={onWatchLight}
              className="hero-cta flex items-center gap-2 rounded-md border-[1.5px] px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-[rgba(99,102,241,0.15)] hover:shadow-cta-glow"
              style={{
                borderImage: 'var(--gradient-spectrum) 1',
                borderImageSlice: 1,
              }}
            >
              Watch the light <Play size={13} />
            </button>
          </div>

          <p className="hero-proof data-mono mt-8 text-xs leading-relaxed text-text-3">
            1,300+ player profiles · 13 prop markets · 30–240 rolling windows · No book affiliation
          </p>
          {/* Counts measured against the warehouse 2026-07-28 (see StatBand in
              sections.tsx for the query). The previous band said "2,400+ profiles"
              (actual: 1,324) and "8 research tools" — a count with no clean
              enumeration (5 nav destinations, 7 dashboard tabs), so it was
              replaced with the verifiable prop-market count. */}
        </div>

        {/* Right column: prism visual */}
        <div ref={visualWrap} className="relative h-[380px] sm:h-[460px] lg:h-[560px]">
          {useFallback ? (
            <div className="relative h-full w-full overflow-hidden rounded-xl">
              <img
                src="/hero-prism.png"
                alt="A white beam of light refracting through a glass prism into a spectrum"
                className="h-full w-full object-cover"
                fetchPriority="high"
              />
              {/* CSS beam sweep */}
              <div
                className="hero-beam absolute left-0 top-1/3 h-px w-1/2"
                style={{ background: 'linear-gradient(90deg, transparent, #fff)', opacity: 0.8 }}
              />
            </div>
          ) : (
            <Suspense
              fallback={
                <img
                  src="/hero-prism.png"
                  alt="A white beam of light refracting through a glass prism into a spectrum"
                  className="h-full w-full rounded-xl object-cover"
                  fetchPriority="high"
                />
              }
            >
              {/* Decorative beam/rays overlays synchronized with the 3D load */}
              <HeroPrism />
              <div className="pointer-events-none absolute inset-0">
                <div className="hero-beam absolute left-[2%] top-[34%] h-px w-[30%]" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.7))' }} />
                {['#8B5CF6', '#22D3EE', '#2DD4BF', '#FBBF24', '#F472B6'].map((c, i) => (
                  <div
                    key={c}
                    className="hero-ray absolute h-px w-[26%]"
                    style={{
                      right: '2%',
                      top: `${38 + i * 5}%`,
                      background: `linear-gradient(90deg, ${c}, transparent)`,
                      opacity: 0.5,
                    }}
                  />
                ))}
              </div>
            </Suspense>
          )}
        </div>
      </div>

      {/* Stat ticker marquee */}
      <div className="relative border-t border-line py-4">
        <div className="overflow-hidden">
          <div className="flex w-max animate-marquee gap-8">
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} className="data-mono flex items-center gap-8 whitespace-nowrap text-xs text-text-3">
                {item}
                <img src="/favicon.svg" alt="" className="h-3.5 w-3.5 opacity-50" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
