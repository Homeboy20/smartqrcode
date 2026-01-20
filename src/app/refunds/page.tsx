import Link from 'next/link';

export const metadata = {
  title: 'Refund Policy - ScanMagic',
  description: 'Refund policy for ScanMagic subscriptions and paid trials.',
};

export default function RefundPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Refund Policy</h1>
      <p className="mt-2 text-sm text-gray-600">Last updated: January 20, 2026</p>

      <div className="mt-8 prose prose-gray max-w-none">
        <p>
          This Refund Policy explains how refunds work for ScanMagic purchases. If you have questions or want to request
          a refund, email <strong>support@scanmagic.online</strong> from the email address on your account.
        </p>

        <h2>Money-back guarantee</h2>
        <p>
          We offer a <strong>14-day money-back guarantee</strong> for eligible purchases made through ScanMagic.
        </p>

        <h3>Eligible purchases</h3>
        <ul>
          <li>
            <strong>New subscriptions</strong> (monthly or yearly): refundable within 14 days of your first payment for
            that subscription.
          </li>
          <li>
            <strong>Paid trials</strong> (one-time, non-recurring): refundable within 14 days of purchase.
          </li>
        </ul>

        <h3>Not typically refundable</h3>
        <ul>
          <li>
            <strong>Renewals</strong>: renewal payments (e.g., month 2+) are generally not refundable, but contact us if
            something went wrong and we will review.
          </li>
          <li>
            <strong>Misuse or abuse</strong>: accounts terminated for fraud, chargeback abuse, or policy violations may
            be ineligible.
          </li>
        </ul>

        <h2>Cancel anytime</h2>
        <p>
          You can cancel your subscription at any time. Cancellation stops future renewals. Your access typically
          continues until the end of the current paid period.
        </p>
        <p>
          Paid trials do not auto-renew. If you buy a paid trial, it ends automatically at the end of the trial window
          unless you choose to upgrade.
        </p>

        <h2>How to request a refund</h2>
        <ol>
          <li>Email <strong>support@scanmagic.online</strong> within 14 days of the charge.</li>
          <li>Include your account email and the plan purchased (Pro/Business, monthly/yearly/trial).</li>
          <li>If you have a payment reference/receipt, include it (optional but helps).</li>
        </ol>

        <h2>Timing</h2>
        <p>
          If approved, we will issue the refund to the original payment method. Processing time depends on your bank and
          payment provider and may take several business days.
        </p>

        <h2>Policy updates</h2>
        <p>
          We may update this policy from time to time. We will post changes on this page and update the “Last updated”
          date.
        </p>

        <p>
          Related policies: <Link href="/terms&condition">Terms of Service</Link> and{' '}
          <Link href="/privacypolicy">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
