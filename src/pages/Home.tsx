import { useCallback } from 'react'
import Hero from '@/pages/home/Hero'
import Showcase from '@/pages/home/Showcase'
import HowItWorks from '@/pages/home/HowItWorks'
import { useLenis } from '@/pages/home/useLenis'
import { StatBand, TwoSports, ValueProps } from '@/pages/home/sections'
import { ToolsBento, Testimonials, PricingPreview, FinalCTA } from '@/pages/home/sections2'

/**
 * Prizm landing page (home.md): S2 hero → S3 stat band → S4 two sports →
 * S5 pinned showcase → S6 value props → S7 tools bento → S8 how it works →
 * S9 testimonials → S10 pricing preview → S11 final CTA.
 * (S1 navbar + S12 footer live in the marketing Layout.)
 */
export default function Home() {
  useLenis()

  const scrollToShowcase = useCallback(() => {
    document.getElementById('showcase')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    // overflow-x-clip: scroll-reveal animations (e.g. testimonials sliding in
    // from ±40px) must not create persistent horizontal page pan on mobile.
    <div className="overflow-x-clip">
      <Hero onWatchLight={scrollToShowcase} />
      <StatBand />
      <TwoSports />
      <Showcase />
      <ValueProps />
      <ToolsBento />
      <HowItWorks />
      <Testimonials />
      <PricingPreview />
      <FinalCTA />
    </div>
  )
}
