import { Link } from 'react-router'
import { Twitter, MessageCircle, Youtube } from 'lucide-react'

const PRODUCT_LINKS = [
  { label: 'Dashboards', to: '/dashboard' },
  { label: 'Hit Rates', to: '/hit-rates' },
  { label: 'Profiler', to: '/profiler' },
  { label: 'GameCenter', to: '/gamecenter' },
  { label: 'EdgeCenter', to: '/edgecenter' },
  { label: 'My Angles', to: '/angles' },
]

const COMPANY_LINKS = [
  { label: 'Pricing', to: '/pricing' },
  { label: 'FAQ', to: '/faq' },
  { label: 'Terms', to: '/terms' },
  { label: 'Privacy', to: '/privacy' },
]

export default function Footer() {
  return (
    <footer className="border-t border-line bg-bg-1">
      <div className="mx-auto max-w-[1200px] px-6 pb-8 pt-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-3">
              <img src="/logo.svg" alt="" className="h-7 w-auto" />
              <span className="font-display text-[15px] font-bold tracking-[0.28em] text-text-1">
                PRIZM
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-text-2">
              See every side of the bet. Rolling splits, hit rates, and matchup reads for MLB
              &amp; NHL prop research.
            </p>
            <div className="mt-6 h-px w-40 opacity-60" style={{ background: 'var(--gradient-spectrum)' }} />
          </div>

          {/* Product */}
          <div>
            <h3 className="overline-caption mb-4 text-text-3">Product</h3>
            <ul className="space-y-2.5">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm text-text-2 transition-colors hover:text-text-1">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="overline-caption mb-4 text-text-3">Company</h3>
            <ul className="space-y-2.5">
              {COMPANY_LINKS.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm text-text-2 transition-colors hover:text-text-1">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-12 text-xs leading-relaxed text-text-3">
          For entertainment &amp; research. Not a sportsbook. 21+. MLB stats: official MLB feeds + Statcast warehouse. NHL stats: official NHL feeds. Odds: aggregated book lines (30+ sportsbooks) refreshed daily; informational only, not betting advice.
          {/* "30+ sportsbooks" — warehouse-verified 2026-07-28: 32 distinct
              over/under book entries in sv_odds, 30 distinct brands (Hard Rock
              Bet appears as three regional entries). Floor, not a literal;
              query recorded at Faq.tsx. Was "34 books" — wrong both ways. */}
        </p>

        <div className="mt-6 flex items-center justify-between border-t border-line pt-8">
          <p className="data-mono text-xs text-text-3">© 2026 Prizm Analytics</p>
          <div className="flex items-center gap-4">
            <a href="https://x.com/prizm" target="_blank" rel="noreferrer" aria-label="Prizm on X" className="text-text-3 transition-colors hover:text-text-1">
              <Twitter size={18} strokeWidth={1.5} />
            </a>
            <a href="https://discord.gg/prizm" target="_blank" rel="noreferrer" aria-label="Prizm Discord" className="text-text-3 transition-colors hover:text-text-1">
              <MessageCircle size={18} strokeWidth={1.5} />
            </a>
            <a href="https://youtube.com/@prizm" target="_blank" rel="noreferrer" aria-label="Prizm on YouTube" className="text-text-3 transition-colors hover:text-text-1">
              <Youtube size={18} strokeWidth={1.5} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
