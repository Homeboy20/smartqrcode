import Link from 'next/link';

export const metadata = {
  title: 'Guides - ScanMagic',
  description: 'Practical guides and best practices for QR codes, barcodes, and getting started with ScanMagic.',
};

export default function BlogPage() {
  return (
    <div className="bg-white">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Guides & Resources</h1>
          <p className="mt-4 text-lg text-gray-600">
            Short, practical guides for using QR codes and barcodes professionally — plus tips to convert scans into
            customers.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
          <Link
            href="/blog/getting-started"
            className="group rounded-2xl border border-gray-200 bg-gray-50 p-6 hover:bg-white hover:shadow-sm transition"
          >
            <div className="text-xs font-semibold text-indigo-700">Getting started</div>
            <div className="mt-2 text-lg font-bold text-gray-900 group-hover:text-indigo-700">ScanMagic in 5 minutes</div>
            <p className="mt-2 text-sm text-gray-600">Create, download, and manage your first codes.</p>
          </Link>

          <Link
            href="/blog/qr-codes-for-business"
            className="group rounded-2xl border border-gray-200 bg-gray-50 p-6 hover:bg-white hover:shadow-sm transition"
          >
            <div className="text-xs font-semibold text-indigo-700">QR codes</div>
            <div className="mt-2 text-lg font-bold text-gray-900 group-hover:text-indigo-700">QR codes that convert</div>
            <p className="mt-2 text-sm text-gray-600">Best practices for menus, flyers, and checkout links.</p>
          </Link>

          <Link
            href="/blog/barcodes-for-inventory"
            className="group rounded-2xl border border-gray-200 bg-gray-50 p-6 hover:bg-white hover:shadow-sm transition"
          >
            <div className="text-xs font-semibold text-indigo-700">Barcodes</div>
            <div className="mt-2 text-lg font-bold text-gray-900 group-hover:text-indigo-700">Barcodes for inventory</div>
            <p className="mt-2 text-sm text-gray-600">Labeling patterns that stay readable and consistent.</p>
          </Link>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            View Pricing
          </Link>
          <Link
            href="/dashboard#generator"
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
  );
}
