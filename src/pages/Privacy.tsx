import LegalPage from '@/pages/terms/LegalPage'
import type { LegalSection } from '@/pages/terms/LegalPage'

const SECTIONS: LegalSection[] = [
  {
    id: 'what-we-collect',
    title: 'What We Collect',
    body: (
      <>
        <p>
          <strong className="font-semibold text-text-1">Account data:</strong> your name, email
          address, and password (stored only as a secure hash). If you use an affiliate code at
          signup, we store it with your account.
        </p>
        <p>
          <strong className="font-semibold text-text-1">Billing data:</strong> payments are processed
          by our payment provider; we store only the last four digits of your card and your billing
          zip/postal code — never full card numbers.
        </p>
        <p>
          <strong className="font-semibold text-text-1">Usage data:</strong> pages viewed, features
          used, saved angles, search queries, and device/browser metadata used to keep the Service
          fast and reliable.
        </p>
      </>
    ),
  },
  {
    id: 'how-we-use-it',
    title: 'How We Use It',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>Provide, maintain, and improve the Service and its features.</li>
        <li>Process subscriptions, trials, and payments.</li>
        <li>Send product updates and (if you opt in) research and marketing emails.</li>
        <li>Attribute affiliate referrals and pay partners.</li>
        <li>Detect abuse, fraud, and violations of our Terms.</li>
      </ul>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies & Storage',
    body: (
      <p>
        We use a small set of cookies and localStorage entries: session tokens (required to sign
        in), your plan/view preferences (e.g. prizm_plan), saved angles and follows (prizm_angles,
        prizm_followed), and demo query counters (prizm_queries). Analytics cookies are used in
        aggregate only. Clearing these resets your demo state but not your subscription.
      </p>
    ),
  },
  {
    id: 'sharing',
    title: 'Sharing',
    body: (
      <p>
        We do not sell your personal data. We share data only with service providers who operate the
        Service (payment processing, email delivery, analytics, hosting), each bound by contractual
        confidentiality, or when required by law. Aggregate, de-identified statistics may be shared
        publicly (for example, product benchmarks).
      </p>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your Rights',
    body: (
      <>
        <p>
          You may access, correct, export, or delete your personal data at any time from your
          account settings, or by emailing us. Deleting your account removes your personal data from
          active systems within 30 days, except records we must retain for legal or accounting
          purposes.
        </p>
        <p>
          Depending on your jurisdiction (including GDPR and CCPA/CPRA), you may have additional
          rights — to opt out of certain processing, to portability, or to lodge a complaint with a
          regulator. We honor those rights for all users regardless of location.
        </p>
      </>
    ),
  },
  {
    id: 'data-retention',
    title: 'Data Retention',
    body: (
      <p>
        Account and billing records are kept while your account is active and for the period
        required by tax and accounting law afterward (typically up to 7 years). Usage logs are
        retained for 12 months, then aggregated or deleted. Backups roll off within 90 days.
      </p>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <p>
        All traffic is encrypted in transit (TLS) and sensitive data is encrypted at rest. Passwords
        are salted and hashed. Access to production systems is limited to authorized personnel under
        least-privilege controls. No method of transmission or storage is 100% secure; if we ever
        suffer a breach affecting your data, we will notify you promptly.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes',
    body: (
      <p>
        We may update this policy as the Service evolves. We will post the new version here and
        update the effective date; for material changes we will also notify you by email or in-app
        message before they take effect.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        Privacy questions or requests:{' '}
        <a href="mailto:privacy@prizm.bet" className="text-sp-indigo hover:brightness-125">
          privacy@prizm.bet
        </a>
        . We aim to respond within two business days.
      </p>
    ),
  },
]

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      meta="Effective January 1, 2026 · Last updated March 1, 2026"
      sections={SECTIONS}
    />
  )
}
