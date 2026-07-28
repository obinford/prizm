import { Link } from 'react-router'
import LegalPage from '@/pages/terms/LegalPage'
import type { LegalSection } from '@/pages/terms/LegalPage'

const SECTIONS: LegalSection[] = [
  {
    id: 'acceptance',
    title: 'Acceptance',
    body: (
      <>
        <p>
          By creating an account, starting a trial, or otherwise using Prizm (the "Service"), you
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
          AI-generated research content for Major League Baseball and the National Hockey League.
          Features vary by plan and may change over time.
        </p>
        <p>
          <strong className="font-semibold text-text-1">Data sources:</strong> MLB stats come from
          official MLB feeds plus the Statcast warehouse; NHL stats come from official NHL feeds.
          Odds are aggregated book lines (34 books) refreshed daily — informational only, not
          betting advice.
        </p>
      </>
    ),
  },
  {
    id: 'accounts-trials',
    title: 'Accounts & Trials',
    body: (
      <>
        <p>
          One account per person. You are responsible for activity under your account and for
          keeping your credentials confidential.
        </p>
        <p>
          The 7-day free trial requires a valid payment method up front. You are not charged during
          the trial; unless you cancel before it ends, your chosen plan bills automatically on day 8.
          We may limit trials to one per customer.
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
          Subscriptions renew automatically on a monthly or annual basis at $12.99/$24.99 per month
          or $149.99/$249.99 per year, depending on plan, plus applicable taxes. Prices may change
          with at least 30 days' notice; changes apply to your next renewal.
        </p>
        <p>
          Upgrades are prorated immediately; downgrades and cancellations take effect at the end of
          the current billing period. First-month refunds are available on request — email
          support@prizm.bet.
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
        or without notice. You may cancel anytime from your account settings; cancellation stops
        future billing and preserves access until the end of the paid period. Provisions that by
        their nature should survive termination survive.
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
