import Link from 'next/link';

export const metadata = {
  title: 'About - ScanMagic',
  description: 'Learn what ScanMagic is, who it’s for, and how we handle privacy and billing.',
};

export default function AboutPage() {
  return (
    <div className="bg-white">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">About ScanMagic</h1>
          <p className="mt-4 text-lg text-gray-600">
            ScanMagic helps you create high-quality QR codes and barcodes for real business use — menus, flyers, product
            labels, tickets, and more — without complicated setup.
          </p>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <div className="text-sm font-semibold text-gray-900">Fast</div>
              <div className="mt-1 text-sm text-gray-600">Generate and download in seconds.</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <div className="text-sm font-semibold text-gray-900">Professional</div>
              <div className="mt-1 text-sm text-gray-600">Clean exports for print and web.</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <div className="text-sm font-semibold text-gray-900">Built for teams</div>
              <div className="mt-1 text-sm text-gray-600">Manage codes, track usage, and scale.</div>
            </div>
          </div>

          <div className="mt-10 prose prose-gray max-w-none">
            <h2>What you can do with ScanMagic</h2>
            <ul>
              <li>Create QR codes for URLs, text, contact info, Wi‑Fi, and more.</li>
              <li>Create barcodes (for inventory, retail labels, and internal tracking).</li>
              <li>Customize styles, sizes, and colors for your brand.</li>
              <li>Save and manage your codes in your dashboard.</li>
            </ul>

            <h2>Privacy & security</h2>
            <p>
              We take privacy seriously. We only collect what’s needed to operate the service (account, billing, and
              product usage). For full details, see our{' '}
              <Link href="/privacypolicy" className="text-indigo-700 hover:text-indigo-800">Privacy Policy</Link>.
            </p>

            <h2>Billing, cancellation, and refunds</h2>
            <p>
              You can cancel anytime. Eligible purchases are covered by our 14‑day money‑back guarantee — see the{' '}
              <Link href="/refunds" className="text-indigo-700 hover:text-indigo-800">Refund Policy</Link>. By using
              ScanMagic, you agree to our{' '}
              <Link href="/terms&condition" className="text-indigo-700 hover:text-indigo-800">Terms</Link>.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              View Pricing
            </Link>
            <Link
              href="/generator"
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Open Generator
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}