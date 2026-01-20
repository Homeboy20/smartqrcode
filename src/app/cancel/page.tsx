import Link from 'next/link';

export const metadata = {
  title: 'Checkout Canceled - ScanMagic',
  description: 'Your checkout was canceled. You can try again anytime or contact support for help.',
};

export default async function CancelPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const reason = typeof searchParams?.reason === 'string' ? searchParams.reason : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-10 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-800">
              <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v3m0 4h.01M10.29 3.86l-7.5 13A1.5 1.5 0 004.08 19h15.84a1.5 1.5 0 001.29-2.14l-7.5-13a1.5 1.5 0 00-2.62 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">Checkout canceled</h1>
              <p className="mt-2 text-sm sm:text-base text-gray-600">
                No worries — you weren’t charged. You can try again when you’re ready.
              </p>
              {reason && <p className="mt-2 text-sm text-gray-500">Reason: {reason}</p>}
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-sm font-semibold text-gray-900">Quick help</div>
            <ul className="mt-2 space-y-1 text-sm text-gray-700">
              <li>If your card/bank declined, try a different payment method.</li>
              <li>If you’re unsure which plan to pick, compare features on the pricing page.</li>
              <li>For invoice/help, contact support and we’ll respond by email.</li>
            </ul>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Back to Pricing
            </Link>
            <Link
              href="/checkout"
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Try Checkout Again
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              Contact Support
            </Link>
          </div>

          <div className="mt-6 text-xs text-gray-500">
            <Link href="/refunds" className="text-indigo-700 hover:text-indigo-800">
              Refund policy
            </Link>
            <span className="mx-2">•</span>
            <Link href="/terms&condition" className="text-indigo-700 hover:text-indigo-800">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
