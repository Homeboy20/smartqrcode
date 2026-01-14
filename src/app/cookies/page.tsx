import Link from 'next/link';

export const metadata = {
  title: 'Cookie Policy - ScanMagic',
  description: 'Cookie policy for ScanMagic.',
};

export default function CookiesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Cookie Policy</h1>
      <p className="mt-4 text-gray-600">
        We use cookies and similar technologies to help the site function, understand usage, and improve your experience.
      </p>

      <div className="mt-6 space-y-3 text-gray-700">
        <p>
          <span className="font-medium text-gray-900">Essential cookies</span> help the app remember your session and security settings.
        </p>
        <p>
          <span className="font-medium text-gray-900">Analytics</span> may be used to understand aggregate usage patterns.
        </p>
        <p>
          You can control cookies through your browser settings. Some features may not work if cookies are disabled.
        </p>
      </div>

      <div className="mt-8">
        <Link href="/privacypolicy" className="text-indigo-600 hover:text-indigo-700 hover:underline">
          Read the Privacy Policy
        </Link>
      </div>
    </div>
  );
}
