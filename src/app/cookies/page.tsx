import Link from 'next/link';

export const metadata = {
  title: 'Cookie Policy - ScanMagic',
  description: 'Cookie Policy for ScanMagic (QR Code & Barcode Generator).',
};

export default function CookiesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Cookie Policy</h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: January 20, 2026</p>

      <p className="mt-4 text-gray-700">
        We use cookies and similar technologies (like local storage) to help the site function, remember preferences,
        understand usage, and improve your experience.
      </p>

      <div className="mt-8 space-y-6 text-gray-700">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">What are cookies?</h2>
          <p className="mt-2">
            Cookies are small text files stored on your device. Cookies can be “session” cookies (deleted when you close
            your browser) or “persistent” cookies (stored until they expire or you delete them).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">How we use cookies</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Enable core functionality (authentication, security, and load balancing).</li>
            <li>Remember preferences (for example, a selected country override used to personalize pricing).</li>
            <li>Measure and improve performance and reliability.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Types of cookies we may use</h2>

          <p className="mt-2">
            <span className="font-medium text-gray-900">Strictly necessary cookies</span> are required to provide the Service
            (for example, sign-in and session security).
          </p>
          <p className="mt-2">
            <span className="font-medium text-gray-900">Functional cookies</span> help remember your choices and preferences.
          </p>
          <p className="mt-2">
            <span className="font-medium text-gray-900">Analytics cookies</span> help us understand how users interact with the
            Service so we can improve it.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Your choices</h2>
          <p className="mt-2">
            You can control cookies through your browser settings (including blocking or deleting cookies). Some features
            may not work properly if cookies are disabled.
          </p>
          <p className="mt-2">
            If you clear browser storage (cookies/local storage), you may lose saved preferences.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Third-party cookies</h2>
          <p className="mt-2">
            Some cookies may be set by third-party services (for example, payment providers or analytics providers). Those
            third parties have their own privacy policies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">More information</h2>
          <p className="mt-2">
            For details on how we handle personal information, read our{' '}
            <Link href="/privacypolicy" className="text-indigo-600 hover:text-indigo-700 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
          <p className="mt-2">
            Questions about cookies? Contact: <span className="font-medium text-gray-900">support@scanmagic.online</span>
          </p>
        </section>
      </div>
    </div>
  );
}
