"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import QRCodeGenerator from "@/components/QRCodeGenerator";
import BarcodeGenerator from "@/components/BarcodeGenerator";
import SequenceGenerator from "@/components/SequenceGenerator";
import BulkSequenceGenerator from "@/components/BulkSequenceGenerator";

// Unified component for code generation
function UnifiedGenerator() {
  const [activeTab, setActiveTab] = useState<string>("qrcode");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (['qrcode', 'barcode', 'sequence', 'bulk'].includes(hash)) {
      setActiveTab(hash);
    } else {
      const savedTab = localStorage.getItem('activeGeneratorTab');
      if (savedTab && ['qrcode', 'barcode', 'sequence', 'bulk'].includes(savedTab)) {
        setActiveTab(savedTab);
      }
    }
    setIsInitialized(true);
  }, []);
  
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeGeneratorTab', tab);
      window.history.replaceState(null, '', `#${tab}`);
    }
  };

  if (!isInitialized) {
    return <div className="w-full h-64 bg-gray-100 rounded-lg animate-pulse"></div>;
  }
  
  return (
    <div className="w-full">
      {/* Tab Navigation */}
      <div className="w-full bg-gray-50 rounded-xl p-2 border border-gray-200 mb-6">
        <nav className="flex flex-wrap justify-center gap-2" aria-label="Generator tabs">
          <button
            onClick={() => handleTabChange('qrcode')}
            id="tab-qrcode"
            aria-selected={activeTab === 'qrcode'}
            className={`${
              activeTab === 'qrcode'
                ? "bg-indigo-600 text-white font-bold shadow-md"
                : "bg-white text-gray-700 hover:text-indigo-600 hover:bg-indigo-50"
            } whitespace-nowrap py-3 px-5 rounded-lg font-medium text-sm sm:text-base transition-all duration-200`}
          >
            🔲 QR Code
          </button>
          <button
            onClick={() => handleTabChange('barcode')}
            id="tab-barcode"
            aria-selected={activeTab === 'barcode'}
            className={`${
              activeTab === 'barcode'
                ? "bg-indigo-600 text-white font-bold shadow-md"
                : "bg-white text-gray-700 hover:text-indigo-600 hover:bg-indigo-50"
            } whitespace-nowrap py-3 px-5 rounded-lg font-medium text-sm sm:text-base transition-all duration-200`}
          >
            📊 Barcode
          </button>
          <button
            onClick={() => handleTabChange('sequence')}
            id="tab-sequence"
            aria-selected={activeTab === 'sequence'}
            className={`${
              activeTab === 'sequence'
                ? "bg-indigo-600 text-white font-bold shadow-md"
                : "bg-white text-gray-700 hover:text-indigo-600 hover:bg-indigo-50"
            } whitespace-nowrap py-3 px-5 rounded-lg font-medium text-sm sm:text-base transition-all duration-200`}
          >
            🔢 Sequence
          </button>
          <button
            onClick={() => handleTabChange('bulk')}
            id="tab-bulk"
            aria-selected={activeTab === 'bulk'}
            className={`${
              activeTab === 'bulk'
                ? "bg-indigo-600 text-white font-bold shadow-md"
                : "bg-white text-gray-700 hover:text-indigo-600 hover:bg-indigo-50"
            } whitespace-nowrap py-3 px-5 rounded-lg font-medium text-sm sm:text-base transition-all duration-200`}
          >
            📦 Bulk Generator
          </button>
        </nav>
      </div>
      
      {/* Generator Components */}
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
        {activeTab === "qrcode" && <QRCodeGenerator />}
        {activeTab === "barcode" && <BarcodeGenerator />}
        {activeTab === "sequence" && <SequenceGenerator />}
        {activeTab === "bulk" && <BulkSequenceGenerator />}
      </div>
    </div>
  );
}

// Stats counter component
function StatItem({ number, label }: { number: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl sm:text-4xl font-bold text-indigo-600">{number}</div>
      <div className="text-gray-600 text-sm sm:text-base mt-1">{label}</div>
    </div>
  );
}

// Feature card component
function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <article className="flex flex-col items-center group hover:bg-indigo-50 p-6 rounded-2xl transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl border border-gray-100">
      <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white mb-4 shadow-lg group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-gray-900 text-center">{title}</h3>
      <p className="mt-3 text-base text-gray-600 text-center leading-relaxed">
        {description}
      </p>
    </article>
  );
}

// Use case card
function UseCaseCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow border border-gray-100">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  );
}

// FAQ Item
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="border-b border-gray-200 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-5 flex justify-between items-center text-left hover:text-indigo-600 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="font-semibold text-gray-900 pr-4">{question}</span>
        <svg
          className={`w-5 h-5 text-indigo-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="pb-5 text-gray-600 leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-yellow-300 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 py-16 sm:py-24 lg:py-32 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight">
              Free QR Code & Barcode
              <span className="block text-yellow-400 mt-2">Generator Online</span>
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-lg sm:text-xl text-indigo-100 leading-relaxed">
              Create custom QR codes and barcodes instantly. No signup required. 
              Download in PNG, SVG, or JPEG format. Perfect for business cards, 
              product labels, marketing materials, and more.
            </p>
            
            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="#generator" 
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-indigo-900 bg-yellow-400 rounded-xl hover:bg-yellow-300 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Create QR Code Free
                <svg className="ml-2 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
              <Link 
                href="/pricing/" 
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-white/10 backdrop-blur rounded-xl hover:bg-white/20 transition-all border border-white/20"
              >
                View Pricing Plans
              </Link>
            </div>
            
            {/* Trust indicators */}
            <div className="mt-12 flex flex-wrap justify-center gap-8 text-indigo-200 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                No signup required
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                100% Free to use
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                High-resolution downloads
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Generator Section */}
      <section id="generator" className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Create Your Code in Seconds
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Choose your code type below and customize it to match your brand. 
              Download instantly in your preferred format.
            </p>
          </div>
          <UnifiedGenerator />
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatItem number="500K+" label="QR Codes Generated" />
            <StatItem number="50+" label="Barcode Formats" />
            <StatItem number="99.9%" label="Uptime" />
            <StatItem number="10K+" label="Happy Users" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-indigo-600 font-semibold text-sm uppercase tracking-wider">Why Choose Us</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
              Powerful Features for All Your Needs
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Whether you need a single QR code or thousands of barcodes, we have got you covered 
              with professional-grade tools that are easy to use.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                </svg>
              }
              title="Dynamic QR Codes"
              description="Create QR codes for URLs, text, WiFi, vCards, emails, phone numbers, and more. Customize colors and add your logo."
            />
            <FeatureCard
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              }
              title="Multiple Barcode Formats"
              description="Generate CODE128, CODE39, EAN-13, EAN-8, UPC-A, ITF-14, ISBN, and many more industry-standard barcode formats."
            />
            <FeatureCard
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              }
              title="Multiple Download Formats"
              description="Download your codes as high-resolution PNG, scalable SVG, or compressed JPEG. Perfect for print and digital use."
            />
            <FeatureCard
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              }
              title="Bulk Generation"
              description="Need hundreds of codes? Our bulk generator creates sequential or custom batches in seconds. Download as ZIP."
            />
            <FeatureCard
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                </svg>
              }
              title="Full Customization"
              description="Customize colors, sizes, error correction levels, and margins. Make your codes match your brand perfectly."
            />
            <FeatureCard
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              }
              title="Privacy First"
              description="Your data stays private. We do not store your QR code content or track what you generate. Safe and secure."
            />
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-indigo-600 font-semibold text-sm uppercase tracking-wider">Use Cases</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
              How Businesses Use Our QR Codes
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              From small businesses to enterprise, see how QR codes and barcodes 
              can transform your operations.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <UseCaseCard
              icon="🏪"
              title="Retail & E-commerce"
              description="Product labels, inventory management, and price tags with scannable barcodes."
            />
            <UseCaseCard
              icon="🍽️"
              title="Restaurants & Cafes"
              description="Contactless menus, table ordering, WiFi access, and loyalty programs."
            />
            <UseCaseCard
              icon="📦"
              title="Logistics & Shipping"
              description="Package tracking, shipping labels, and warehouse inventory systems."
            />
            <UseCaseCard
              icon="🎫"
              title="Events & Ticketing"
              description="Event tickets, check-in systems, and badge generation for conferences."
            />
            <UseCaseCard
              icon="🏥"
              title="Healthcare"
              description="Patient ID bracelets, medication tracking, and equipment management."
            />
            <UseCaseCard
              icon="🎓"
              title="Education"
              description="Student IDs, library books, assignment submissions, and attendance."
            />
            <UseCaseCard
              icon="🏠"
              title="Real Estate"
              description="Property listings, virtual tours, contact sharing, and open house info."
            />
            <UseCaseCard
              icon="💼"
              title="Business Cards"
              description="Digital vCards, LinkedIn profiles, portfolios, and contact sharing."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 sm:py-24 bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-indigo-600 font-semibold text-sm uppercase tracking-wider">Simple Process</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
              How to Create a QR Code
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">1</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Choose Your Type</h3>
              <p className="text-gray-600">Select QR Code, Barcode, or Sequence generator based on your needs.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">2</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Enter Your Content</h3>
              <p className="text-gray-600">Add your URL, text, or data. Customize colors, size, and format.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">3</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Download & Use</h3>
              <p className="text-gray-600">Download in PNG, SVG, or JPEG. Use in print, web, or anywhere!</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-indigo-600 font-semibold text-sm uppercase tracking-wider">FAQ</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6 sm:p-8">
            <FAQItem
              question="Is this QR code generator really free?"
              answer="Yes! Our basic QR code and barcode generator is completely free to use. No signup required. For advanced features like bulk generation, analytics, and dynamic QR codes, we offer affordable premium plans."
            />
            <FAQItem
              question="What is the difference between QR codes and barcodes?"
              answer="QR codes are 2D codes that can store more data (URLs, text, contact info) and can be scanned from any angle. Barcodes are 1D linear codes typically used for product identification and inventory management with numeric or alphanumeric data."
            />
            <FAQItem
              question="Can I use the generated codes commercially?"
              answer="Absolutely! All codes you generate are yours to use however you like - personal projects, business cards, product packaging, marketing materials, and more. No attribution required."
            />
            <FAQItem
              question="What file formats can I download?"
              answer="We support PNG (best for web and digital), SVG (scalable vector for print and design software), and JPEG (compressed format). Premium users also get EPS format for professional printing."
            />
            <FAQItem
              question="Do QR codes expire?"
              answer="Static QR codes (like the ones our free tool generates) never expire. They are permanent once created. Dynamic QR codes in our premium plans can be edited anytime and include analytics."
            />
            <FAQItem
              question="What barcode formats do you support?"
              answer="We support all major formats: CODE128, CODE39, EAN-13, EAN-8, UPC-A, UPC-E, ITF-14, ISBN, ISSN, MSI, Pharmacode, Codabar, and more. Each format has specific use cases - we will help you choose the right one."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 bg-gradient-to-r from-indigo-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to Create Your First QR Code?
          </h2>
          <p className="text-xl text-indigo-100 mb-10 max-w-2xl mx-auto">
            Join thousands of businesses using our QR code generator. 
            Start creating professional codes in seconds - no signup needed.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="#generator" 
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-indigo-900 bg-yellow-400 rounded-xl hover:bg-yellow-300 transition-all shadow-lg"
            >
              Start Creating Free
            </a>
            <Link 
              href="/pricing/" 
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white border-2 border-white rounded-xl hover:bg-white/10 transition-all"
            >
              Compare Plans
            </Link>
          </div>
        </div>
      </section>

      {/* Schema.org JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "ScanMagic - Free QR Code Generator",
            "description": "Free online QR code and barcode generator. Create custom QR codes for URLs, WiFi, vCards, and more. Download in PNG, SVG, JPEG formats.",
            "url": "https://scanmagic.online",
            "applicationCategory": "UtilityApplication",
            "operatingSystem": "Any",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.8",
              "ratingCount": "1250"
            }
          })
        }}
      />
    </main>
  );
}
