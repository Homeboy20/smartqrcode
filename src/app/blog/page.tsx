import Link from 'next/link';

export const metadata = {
  title: 'Blog - ScanMagic',
  description: 'Product updates and guides for ScanMagic.',
};

export default function BlogPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Blog</h1>
      <p className="mt-4 text-gray-600">
        We’ll post product updates and guides here. For now, use the main app features.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Go to Dashboard
        </Link>
        <Link
          href="/qrcode"
          className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Generate a QR Code
        </Link>
      </div>
    </div>
  );
}
