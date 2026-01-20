import Link from 'next/link';

export const metadata = {
  title: 'Payment Successful - ScanMagic',
  description: 'Your payment was received. Get started with ScanMagic in your dashboard.',
};

export default async function SuccessPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const plan = typeof searchParams?.plan === 'string' ? searchParams?.plan : null;
  const interval = typeof searchParams?.interval === 'string' ? searchParams?.interval : null;

  const planLabel =
    plan === 'business' ? 'Business' : plan === 'pro' ? 'Pro' : plan ? String(plan) : 'your plan';
  const intervalLabel = interval ? String(interval).toLowerCase() : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-10 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-700">
              <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
                Payment successful
              </h1>
              <p className="mt-2 text-sm sm:text-base text-gray-600">
                Thanks — we received your payment{intervalLabel ? ` for ${intervalLabel}` : ''}. You can start using
                ScanMagic right away.
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Plan: <span className="font-semibold text-gray-800">{planLabel}</span>
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900">Next steps</div>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                <li>Open the dashboard and start generating QR codes / barcodes.</li>
                <li>If you bought a subscription, you can manage billing anytime.</li>
                <li>Need help? Contact support — we reply by email.</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/account/subscription"
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              Manage Subscription
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              Contact Support
            </Link>
          </div>

          <div className="mt-6 text-xs text-gray-500">
            <span>Cancel anytime</span>
            <span className="mx-2">•</span>
            <Link href="/refunds" className="text-indigo-700 hover:text-indigo-800">
              14-day money-back guarantee (see policy)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
