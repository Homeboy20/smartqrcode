import Link from 'next/link';

export const metadata = {
  title: 'Getting Started - ScanMagic',
  description: 'Create your first QR code or barcode and start managing codes in ScanMagic.',
};

export default function GettingStartedPage() {
  return (
    <div className="bg-white">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="prose prose-gray max-w-none">
          <h1>Getting started with ScanMagic</h1>
          <p>
            ScanMagic is designed to be fast: generate a code, download it, and keep everything organized in your
            dashboard.
          </p>

          <h2>1) Choose what you’re creating</h2>
          <ul>
            <li>QR code: best for links, menus, contact details, and promotions.</li>
            <li>Barcode: best for internal tracking, inventory, and product labels.</li>
          </ul>

          <h2>2) Generate and download</h2>
          <ul>
            <li>Pick the type, enter your content, and customize colors/size.</li>
            <li>Download as an image and test-scan it before printing.</li>
          </ul>

          <h2>3) Manage your codes</h2>
          <p>
            If you’re using ScanMagic for business, the dashboard helps you keep codes organized and avoid re-creating the
            same code repeatedly.
          </p>

          <h2>Best practice checklist</h2>
          <ul>
            <li>Use a clear call-to-action near the code (e.g., “Scan to order”).</li>
            <li>Keep enough contrast between foreground and background.</li>
            <li>Print a test sheet and scan from the expected distance.</li>
            <li>For menus/flyers: avoid placing codes on glossy folds or curved surfaces.</li>
          </ul>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/generator"
            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Open Generator
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
          >
            View Pricing
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
  );
}
