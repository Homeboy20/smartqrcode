import React from "react";

export const metadata = {
  title: "Terms & Conditions - Smart QR & Barcode",
  description: "Terms and Conditions for Smart QR & Barcode Generator",
};

export default function TermsAndConditionsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl mb-4">
          Terms &amp; Conditions
        </h1>
        <p className="text-sm text-gray-600 mb-8">Last updated: January 3, 2026</p>

        <div className="prose prose-lg prose-blue mx-auto">
          <p>
            These Terms &amp; Conditions (“Terms”) govern your use of Smart QR &amp; Barcode (the
            “Service”). By accessing or using the Service, you agree to these Terms.
          </p>

          <h2>Eligibility and accounts</h2>
          <ul>
            <li>You may need an account to access some features.</li>
            <li>You are responsible for maintaining the confidentiality of your account.</li>
            <li>You agree to provide accurate information and keep it up to date.</li>
          </ul>

          <h2>Using the Service</h2>
          <ul>
            <li>
              You may use the Service to generate QR codes and barcodes for lawful purposes.
            </li>
            <li>
              You must not misuse the Service (for example, attempting to disrupt, reverse engineer,
              or bypass security or usage limits).
            </li>
            <li>
              You are responsible for the content you encode in QR codes/barcodes and how you
              distribute or use those codes.
            </li>
          </ul>

          <h2>Free mode, subscriptions, and billing</h2>
          <p>
            The Service may offer free features, paid subscriptions, or promotional/free-mode access.
            Feature availability and usage limits may change based on your plan, account status, or
            Service configuration.
          </p>

          <h2>Intellectual property</h2>
          <p>
            The Service, including its software and design, is owned by us or our licensors and is
            protected by applicable laws. These Terms do not grant you ownership of the Service.
          </p>

          <h2>Third-party services</h2>
          <p>
            The Service may integrate with third-party services (for example, payment providers or
            authentication providers). Your use of those services may be governed by their own terms.
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
