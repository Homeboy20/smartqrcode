import React from "react";

export const metadata = {
  title: "Privacy Policy - ScanMagic",
  description: "Privacy Policy for ScanMagic (QR Code & Barcode Generator).",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl mb-4">
          Privacy Policy
        </h1>
        <p className="text-sm text-gray-600 mb-8">Last updated: January 20, 2026</p>

        <div className="prose prose-lg prose-blue mx-auto">
          <p>
            This Privacy Policy explains how ScanMagic (the “Service”) collects, uses, and shares information when you
            use our website, dashboard, and related features.
          </p>

          <h2>Summary</h2>
          <ul>
            <li>We collect information needed to run the Service (account, security, usage, and billing).</li>
            <li>We do not sell your personal information.</li>
            <li>Payment details are handled by payment providers; we do not store your full card details.</li>
            <li>You can request access/deletion of your data by contacting support.</li>
          </ul>

          <h2>Information we collect</h2>
          <ul>
            <li>
              <strong>Account information</strong>: If you create an account, we may collect
              your email address and basic profile details.
            </li>
            <li>
              <strong>Authentication data</strong>: If you sign in using a third-party provider, we receive an
              identifier and basic profile information made available by that provider based on your settings.
            </li>
            <li>
              <strong>Usage information</strong>: We may collect basic usage events (for example,
              feature usage counts) to operate the Service, enforce limits, and improve reliability.
            </li>
            <li>
              <strong>Device and log information</strong>: Like most websites, our servers may
              record log data such as IP address, browser type, and timestamps.
            </li>
            <li>
              <strong>Payment and billing information</strong>: If you purchase a plan, our payment providers process
              your payment. We may store limited billing metadata such as plan tier, billing interval, amount, currency,
              country, and payment references.
            </li>
          </ul>

          <h2>QR/Barcode content</h2>
          <p>
            Content you enter to generate QR codes or barcodes is processed to deliver the feature. If you choose to
            save codes, manage them in the dashboard, or use dynamic QR features, related data may be stored so the
            feature works.
          </p>

          <h2>Location and pricing personalization</h2>
          <p>
            We may infer an approximate country from request headers to display local currency and supported payment
            methods. You can override this selection in the UI; that preference may be stored locally in your browser.
          </p>

          <h2>How we use information</h2>
          <ul>
            <li>Provide and maintain the Service</li>
            <li>Authenticate users and secure accounts</li>
            <li>Track feature usage to prevent abuse and support billing/free-mode rules</li>
            <li>Debug, monitor, and improve performance and reliability</li>
            <li>Process subscriptions, purchases, refunds, and customer support requests</li>
            <li>Communicate with you about important Service changes</li>
          </ul>

          <h2>How we share information</h2>
          <p>
            We do not sell your personal information. We may share information with:
          </p>
          <ul>
            <li>
              <strong>Service providers</strong> that help us run the Service (for example,
              authentication, hosting, and database providers).
            </li>
            <li>
              <strong>Payment providers</strong> to process payments and prevent fraud.
            </li>
            <li>
              <strong>Legal and safety</strong> recipients when required to comply with law or
              protect the rights, safety, and security of users and the Service.
            </li>
          </ul>

          <h2>International transfers</h2>
          <p>
            Depending on your location, your information may be processed in countries where we or our service
            providers operate.
          </p>

          <h2>Data retention</h2>
          <p>
            We retain personal information for as long as necessary to provide the Service,
            comply with legal obligations, resolve disputes, and enforce agreements.
          </p>

          <h2>Your choices</h2>
          <ul>
            <li>
              You can update certain profile information from your account settings (if available).
            </li>
            <li>
              You may request deletion of your account and associated data, subject to legal and
              operational requirements.
            </li>
          </ul>

          <h2>Cookies</h2>
          <p>
            We use cookies and similar technologies for essential functionality (such as sign-in) and to improve the
            Service. See our Cookie Policy for details.
          </p>

          <h2>Security</h2>
          <p>
            We use reasonable safeguards designed to protect information. No method of
            transmission or storage is 100% secure.
          </p>

          <h2>Children’s privacy</h2>
          <p>
            The Service is not directed to children under 13 (or the minimum age required in your
            jurisdiction). If you believe a child has provided us personal information, contact us.
          </p>

          <h2>Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will post the updated version
            on this page and update the “Last updated” date.
          </p>

          <h2>Contact</h2>
          <p>
            For questions about this Privacy Policy, contact us at: <strong>support@scanmagic.online</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
