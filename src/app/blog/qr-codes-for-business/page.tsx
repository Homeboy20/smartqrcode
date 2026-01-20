import Link from 'next/link';

export const metadata = {
  title: 'QR Codes for Business - ScanMagic',
  description: 'How to design QR codes that get scanned and drive conversions in real-world marketing.',
};

export default function QRCodesForBusinessPage() {
  return (
    <div className="bg-white">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="prose prose-gray max-w-none">
          <h1>QR codes for business: what actually works</h1>
          <p>
            A QR code is only useful if people scan it. The highest-performing codes are easy to see, easy to trust, and
            lead to a fast landing experience.
          </p>

          <h2>Use a clear promise</h2>
          <ul>
            <li>“Scan to view the menu”</li>
            <li>“Scan for today’s discount”</li>
            <li>“Scan to WhatsApp us”</li>
          </ul>

          <h2>Make it scannable (in the real world)</h2>
          <ul>
            <li>High contrast (dark code on light background is safest).</li>
            <li>Leave quiet space (don’t cram text or images right up to the code).</li>
            <li>Print large enough for the scan distance (posters need bigger codes than packaging).</li>
          </ul>

          <h2>Don’t break trust</h2>
          <ul>
            <li>Match the destination to the promise (menu → menu page, not a generic homepage).</li>
            <li>Avoid long load times; keep the landing page lightweight.</li>
            <li>If it’s a payment link, label it clearly.</li>
          </ul>

          <h2>Recommended use cases</h2>
          <ul>
            <li>Restaurants: menu, ordering link, Google reviews link.</li>
            <li>Retail: product info, warranty registration, support contact.</li>
            <li>Events: ticket validation, schedules, venue directions.</li>
          </ul>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/dashboard#generator"
            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Create a QR Code
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
          >
            See Plans
          </Link>
          <Link
            href="/blog"
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            Back to Guides
          </Link>
        </div>
      </div>
    </div>
  );
}
