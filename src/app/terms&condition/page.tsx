import Link from 'next/link';

export const metadata = {
  title: "Terms of Service - ScanMagic",
  description: "Terms of Service for ScanMagic (QR Code & Barcode Generator).",
};

export default function TermsAndConditionsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl mb-4">
          Terms of Service
        </h1>
        <p className="text-sm text-gray-600 mb-8">Last updated: January 20, 2026</p>

        <div className="prose prose-lg prose-blue mx-auto">
          <p>
            These Terms of Service (“Terms”) govern your use of ScanMagic (the “Service”). By accessing or using the
            Service, you agree to these Terms.
          </p>

          <h2>Account and eligibility</h2>
          <ul>
            <li>You may need an account to access certain features (including the dashboard generator).</li>
            <li>You are responsible for maintaining the confidentiality of your account.</li>
            <li>You agree to provide accurate information and keep it up to date.</li>
          </ul>

          <h2>Using the Service</h2>
          <ul>
            <li>
              You may use the Service to generate QR codes and barcodes for lawful purposes.
            </li>
            <li>
              You must not misuse the Service (for example: attempting to disrupt, reverse engineer, scrape at scale,
              or bypass security or usage limits).
            </li>
            <li>
              You are responsible for the content you encode in QR codes/barcodes and how you
              distribute or use those codes.
            </li>
            <li>
              You must not use the Service to create or distribute illegal content, malware, phishing links, or
              content that infringes intellectual property or privacy rights.
            </li>
          </ul>

          <h2>Plans, subscriptions, and billing</h2>
          <p>
            The Service may offer paid subscriptions and paid trials. Feature availability and usage limits may change
            based on your plan, account status, and Service configuration.
          </p>

          <h3>Billing intervals</h3>
          <ul>
            <li><strong>Monthly</strong>: billed each month until canceled.</li>
            <li><strong>Yearly</strong>: billed annually and may include discounted pricing vs monthly.</li>
            <li><strong>Paid trial</strong>: a one-time payment for limited-time access and does not auto-renew.</li>
          </ul>

          <h3>Cancel anytime</h3>
          <p>
            You can cancel at any time. Cancellation stops future renewals. Unless otherwise stated, access continues
            until the end of your current paid period.
          </p>

          <h3>Refunds</h3>
          <p>
            Refunds are described in our <Link href="/refunds/">Refund Policy</Link>. If there is a conflict between
            these Terms and the Refund Policy regarding refunds, the Refund Policy controls.
          </p>

          <h2>Intellectual property</h2>
          <p>
            The Service, including its software and design, is owned by us or our licensors and is
            protected by applicable laws. These Terms do not grant you ownership of the Service.
          </p>

          <h2>Your content</h2>
          <p>
            You retain ownership of the content you provide to the Service. You grant us a limited license to process
            that content only as needed to operate the Service (for example, generating codes, saving projects you
            request, and displaying them in your dashboard).
          </p>

          <h2>Third-party services</h2>
          <p>
            The Service may integrate with third-party services (for example, payment providers or
            authentication providers). Your use of those services may be governed by their own terms.
          </p>

          <h2>Availability and changes</h2>
          <p>
            We may change, suspend, or discontinue parts of the Service, and we may update features, limits, and
            pricing over time. We will make reasonable efforts to communicate material changes.
          </p>

          <h2>Disclaimer</h2>
          <p>
            The Service is provided on an “as is” and “as available” basis. To the maximum extent
            permitted by law, we disclaim warranties of any kind, including implied warranties of
            merchantability, fitness for a particular purpose, and non-infringement.
          </p>

          <h2>Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, we will not be liable for any indirect,
            incidental, special, consequential, or punitive damages, or any loss of profits or data,
            arising out of or related to your use of the Service.
          </p>

          <h2>Termination</h2>
          <p>
            We may suspend or terminate your access to the Service if we reasonably believe you have
            violated these Terms or if needed to protect the Service and other users.
          </p>

          <h2>Governing law</h2>
          <p>
            These Terms are governed by applicable laws based on where we operate and where the Service is provided.
            Some consumer rights may apply depending on your jurisdiction.
          </p>

          <h2>Changes</h2>
          <p>
            We may update these Terms from time to time. We will post the updated version on this
            page and update the “Last updated” date.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about these Terms? Contact: <strong>support@scanmagic.online</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
