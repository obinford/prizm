import { Link } from 'react-router'
import LegalPage from '@/pages/terms/LegalPage'
import type { LegalSection } from '@/pages/terms/LegalPage'

// FIX 13 (2026-07-29): pricing is deferred — this document no longer quotes
// plan prices, trial-billing terms, or renewal mechanics (the plans.ts
// interpolation that guaranteed they matched checkout went with them). When
// paid plans launch, restore exact terms from pages/pricing/plans.ts — a
// legal document quoting a hardcoded price that disagrees with checkout is
// the exact bug that interpolation prevented.

const SECTIONS: LegalSection[] = [
  {
    id: 'acceptance',
    title: 'Acceptance',
    body: (
      <>
        <p>
          By creating an account or otherwise using Prizm (the "Service"), you
          agree to be bound by these Terms of Service and our{' '}
          <Link to="/privacy" className="text-sp-indigo hover:brightness-125">
            Privacy Policy
          </Link>
          . If you do not agree, do not use the Service.
        </p>
        <p>
          The Service is intended for adults aged 21 or older. By using Prizm you represent that you
          are at least 21 years old and legally permitted to access sports-betting research content
          in your jurisdiction.
        </p>
      </>
    ),
  },
  {
    id: 'the-service',
    title: 'The Service',
    body: (
      <>
        <p>
          Prizm provides sports statistics dashboards, rolling-window analysis, hit-rate tools, and
          matchup research content for Major League Baseball and the National Hockey League.
          Prizm is currently in private beta; features may change over time.
        </p>
        <p>
          <strong className="font-semibold text-text-1">Data sources:</strong> MLB stats come from
          official MLB feeds plus the Statcast warehouse; NHL stats come from official NHL feeds.
          Odds are aggregated book lines (30+ sportsbooks) refreshed daily — informational only, not
          betting advice.
        </p>
      </>
    ),
  },
  {
    id: 'accounts-trials',
    title: 'Accounts & Access',
    body: (
      <>
        <p>
          One account per person. You are responsible for activity under your account and for
          keeping your credentials confidential.
        </p>
        <p>
          During the private beta, accounts are created by invitation. When paid plans are
          introduced, any trial, billing, and cancellation terms will be published here before
          they take effect, and continued use after that point constitutes acceptance of them.
        </p>
      </>
    ),
  },
  {
    id: 'billing',
    title: 'Billing',
    body: (
      <>
        <p>
          Prizm does not currently charge for access. No payment method is collected and no
          automatic renewal exists.
        </p>
        <p>
          If paid subscriptions are introduced, prices, renewal terms, proration, cancellation,
          and refund policy will be added to these Terms with at least 30 days' notice before
          any charge occurs. Questions in the meantime: support@prizm.bet.
        </p>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable Use',
    body: (
      <>
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Scrape, crawl, or bulk-export the Service or its data by automated means.</li>
          <li>Resell, sublicense, or redistribute Prizm content or outputs.</li>
          <li>Share your account or credentials with any other person.</li>
          <li>Misrepresent Prizm outputs as guaranteed outcomes or "locks."</li>
          <li>Use the Service in violation of any applicable law or regulation.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'not-betting-advice',
    title: 'Not Betting Advice',
    body: (
      <>
        <p>
          Prizm is a research tool. Nothing on the Service constitutes financial, legal, or wagering
          advice, and no outcome is ever guaranteed. Price alerts, edge scores, and matchup reads are
          informational signals only — the final decision, and the risk, is always yours.
        </p>
        <p>
          Variance is real and no analytical tool removes it. Never bet more than you can afford to
          lose. If gambling stops being fun, call or text 1-800-GAMBLER.
        </p>
      </>
    ),
  },
  {
    id: 'intellectual-property',
    title: 'Intellectual Property',
    body: (
      <p>
        Prizm, the prism mark, the spectrum design system, and all content and software on the
        Service are the property of Prizm Analytics. We grant you a personal, non-commercial,
        non-transferable, revocable license to use the Service while your account is in good
        standing. Saved angles you create remain yours; sharing them grants us a license to display
        them as intended by the share feature.
      </p>
    ),
  },
  {
    id: 'disclaimers',
    title: 'Disclaimers',
    body: (
      <p>
        The Service is provided "as is" and "as available," without warranties of any kind, express
        or implied. Statistics may contain errors, delays, or omissions, and public feeds may
        lag or differ from official records. We do not warrant that the Service will be uninterrupted,
        accurate, or error-free.
      </p>
    ),
  },
  {
    id: 'limitation-of-liability',
    title: 'Limitation of Liability',
    body: (
      <p>
        To the maximum extent permitted by law, Prizm Analytics' aggregate liability arising out of
        or relating to the Service is capped at the amounts you paid us in the trailing 12 months.
        We are not liable for indirect, incidental, or consequential damages — including, without
        limitation, wagering losses of any kind.
      </p>
    ),
  },
  {
    id: 'termination',
    title: 'Termination',
    body: (
      <p>
        We may suspend or terminate your account for abuse, fraud, or violation of these Terms, with
        or without notice. You may close your account at any time by contacting support@prizm.bet.
        Provisions that by their nature should survive termination survive.
      </p>
    ),
  },
  {
    id: 'governing-law',
    title: 'Governing Law',
    body: (
      <p>
        These Terms are governed by the laws of the State of Delaware, USA, without regard to
        conflict-of-law principles. Any dispute will be resolved in the state or federal courts
        located in Delaware, and you consent to their jurisdiction.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        Questions about these Terms? Email{' '}
        <a href="mailto:legal@prizm.bet" className="text-sp-indigo hover:brightness-125">
          legal@prizm.bet
        </a>
        . We aim to respond within two business days.
      </p>
    ),
  },
]

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      meta="Effective January 1, 2026 · Last updated March 1, 2026"
      sections={SECTIONS}
    />
  )
}
