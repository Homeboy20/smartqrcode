import Link from 'next/link';

export const metadata = {
  title: 'Barcodes for Inventory - ScanMagic',
  description: 'Simple barcode best practices for inventory, labeling, and internal tracking workflows.',
};

export default function BarcodesForInventoryPage() {
  return (
    <div className="bg-white">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="prose prose-gray max-w-none">
          <h1>Barcodes for inventory: keep labels readable</h1>
          <p>
            Barcodes are about consistency. If you keep the format predictable and the printing clean, scanning becomes
            fast and error-free.
          </p>

          <h2>Choose a format that fits your workflow</h2>
          <ul>
            <li>CODE128 is a common choice for internal codes and alphanumeric IDs.</li>
            <li>EAN/UPC are typically used for retail packaging standards.</li>
          </ul>

          <h2>Printing tips</h2>
          <ul>
            <li>Use sharp printing (avoid low-quality “draft” mode).</li>
            <li>Don’t compress or stretch the barcode image.</li>
            <li>Leave space around the barcode so scanners can detect edges.</li>
          </ul>

          <h2>Label design</h2>
          <ul>
            <li>Put the human-readable code below the barcode.</li>
            <li>Use durable labels for heat, friction, and moisture environments.</li>
            <li>Keep the barcode area free from folds, seams, and curves.</li>
          </ul>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/dashboard#generator"
            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Create a Barcode
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
          >
            View Pricing
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
