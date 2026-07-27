import { useCallback } from 'react'
import Hero from '@/pages/home/Hero'
import HowItWorks from '@/pages/home/HowItWorks'
import { useLenis } from '@/pages/home/useLenis'
import { StatBand, TwoSports, ValueProps } from '@/pages/home/sections'
import { PricingPreview, FinalCTA } from '@/pages/home/sections2'

/**
 * Prizm landing page: hero → stat band → two sports → value props →
 * how it works → pricing preview → final CTA.
 * (Navbar + footer live in the marketing Layout.)
 *
 * The screenshot-driven sections (pinned showcase, tools bento, testimonials)
 * were removed — they depended on product screenshots and avatar photos that
 * don't exist yet, and shipping broken or fabricated imagery is worse than
 * shipping less page. They return when real assets exist.
 */
export default function Home() {
  useLenis()

  const scrollToHowItWorks = useCallback(() => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    // overflow-x-clip: scroll-reveal animations must not create persistent
    // horizontal page pan on mobile.
    <div className="overflow-x-clip">
      <Hero onWatchLight={scrollToHowItWorks} />
      <StatBand />
      <TwoSports />
      <ValueProps />
      <HowItWorks />
      <PricingPreview />
      <FinalCTA />
    </div>
  )
}
