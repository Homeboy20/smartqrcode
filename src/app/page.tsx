"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import QRCodeGenerator from "@/components/QRCodeGenerator";
import BarcodeGenerator from "@/components/BarcodeGenerator";
import SequenceGenerator from "@/components/SequenceGenerator";
import BulkSequenceGenerator from "@/components/BulkSequenceGenerator";
import { useAuth } from "@/context/FirebaseAuthContext";

// Testimonials data
const testimonials = [
  {
    name: "Sarah Johnson",
    role: "Marketing Manager",
    company: "TechCorp Inc.",
    content: "ScanMagic has revolutionized our marketing campaigns. The analytics feature helps us track QR code performance in real-time.",
    avatar: "SJ"
  },
  {
    name: "Michael Chen",
    role: "Restaurant Owner",
    company: "Golden Dragon",
    content: "We use ScanMagic for our digital menus. Easy to update and customers love the seamless experience!",
    avatar: "MC"
  },
  {
    name: "Emily Rodriguez",
    role: "Event Coordinator",
    company: "EventPro",
    content: "The bulk generation feature is a game-changer. I can create hundreds of unique QR codes for event badges in minutes.",
    avatar: "ER"
  }
];

// Stats data
const stats = [
  { label: "QR Codes Generated", value: "10M+" },
  { label: "Active Users", value: "50K+" },
  { label: "Countries", value: "120+" },
  { label: "Uptime", value: "99.9%" }
];

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
    return <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>;
  }
  
  return (
    <div className="w-full">
      {/* Inline Tab Navigation */}
      <div className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg p-2 border border-gray-100 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex flex-wrap justify-center space-x-2 sm:space-x-6" aria-label="Tabs">
          {/* QR Code Tab */}
          <button
            onClick={() => handleTabChange('qrcode')}
            id="tab-qrcode"
            className={`${
              activeTab === 'qrcode'
                ? "bg-indigo-600 text-white font-bold shadow-md"
                : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-600"
            } whitespace-nowrap py-3 px-4 rounded-lg font-medium text-sm sm:text-base transition-all duration-200 flex-grow sm:flex-grow-0 text-center`}
          >
            QR Code Generator
          </button>
          {/* Barcode Tab */}
          <button
            onClick={() => handleTabChange('barcode')}
            id="tab-barcode"
            className={`${
              activeTab === 'barcode'
                ? "bg-indigo-600 text-white font-bold shadow-md"
                : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-600"
            } whitespace-nowrap py-3 px-4 rounded-lg font-medium text-sm sm:text-base transition-all duration-200 flex-grow sm:flex-grow-0 text-center`}
          >
            Barcode Generator
          </button>
          {/* Sequence Tab */}
          <button
            onClick={() => handleTabChange('sequence')}
            id="tab-sequence"
            className={`${
              activeTab === 'sequence'
                ? "bg-indigo-600 text-white font-bold shadow-md"
                : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-600"
            } whitespace-nowrap py-3 px-4 rounded-lg font-medium text-sm sm:text-base transition-all duration-200 flex-grow sm:flex-grow-0 text-center`}
          >
            Sequence Generator
          </button>
          {/* Bulk Sequence Tab */}
          <button
            onClick={() => handleTabChange('bulk')}
            id="tab-bulk"
            className={`${
              activeTab === 'bulk'
                ? "bg-indigo-600 text-white font-bold shadow-md"
                : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-600"
            } whitespace-nowrap py-3 px-4 rounded-lg font-medium text-sm sm:text-base transition-all duration-200 flex-grow sm:flex-grow-0 text-center`}
          >
            Bulk Sequence Generator
          </button>
        </nav>
      </div>
      
      {/* Generator Components */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        {activeTab === "qrcode" && <QRCodeGenerator />}
        {activeTab === "barcode" && <BarcodeGenerator />}
        {activeTab === "sequence" && <SequenceGenerator />}
        {activeTab === "bulk" && <BulkSequenceGenerator />}
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 opacity-10 dark:opacity-20"></div>
        <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-indigo-600/20 to-transparent"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight">
              <span className="block text-gray-900 dark:text-white">Create Stunning</span>
              <span className="block bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
                QR Codes & Barcodes
              </span>
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-xl text-gray-600 dark:text-gray-300">
              The most powerful QR code and barcode generator. Create, customize, track, and manage your codes with ease. Perfect for businesses of all sizes.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              {!user ? (
                <>
                  <Link 
                    href="/register" 
                    className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                  >
                    Get Started Free
                    <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                  <Link 
                    href="/pricing" 
                    className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl hover:bg-indigo-50 dark:hover:bg-gray-700 transition-all duration-200"
                  >
                    View Pricing
                  </Link>
                </>
              ) : (
                <>
                  <Link 
                    href="/dashboard" 
                    className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                  >
                    Go to Dashboard
                    <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                  <Link 
                    href="#generator" 
                    className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl hover:bg-indigo-50 dark:hover:bg-gray-700 transition-all duration-200"
                  >
                    Create New Code
                  </Link>
                </>
              )}
            </div>
          </div>
          
          {/* Stats Section */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="mt-2 text-gray-600 dark:text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Generator Section */}
      <section id="generator" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Generate Any Code Instantly
          </h2>
          <UnifiedGenerator />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider">Features</span>
            <h2 className="mt-2 text-4xl font-extrabold text-gray-900 dark:text-white">
              Everything You Need to Succeed
            </h2>
            <p className="mt-4 text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Powerful features to create, manage, and track your QR codes and barcodes
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100 dark:border-gray-700">
              <div className="w-14 h-14 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Dynamic QR Codes</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Create QR codes that can be updated anytime. Change destinations without reprinting.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100 dark:border-gray-700">
              <div className="w-14 h-14 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Real-time Analytics</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Track scans, locations, devices, and more. Get insights to optimize your campaigns.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100 dark:border-gray-700">
              <div className="w-14 h-14 bg-gradient-to-r from-pink-500 to-red-500 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Custom Branding</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Add your logo, customize colors, and create branded QR codes that match your identity.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100 dark:border-gray-700">
              <div className="w-14 h-14 bg-gradient-to-r from-green-500 to-teal-500 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Bulk Generation</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Upload CSV files and generate hundreds of unique codes at once. Download as ZIP.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100 dark:border-gray-700">
              <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Multiple Formats</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Download in PNG, SVG, PDF, or EPS. High-resolution outputs perfect for print.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100 dark:border-gray-700">
              <div className="w-14 h-14 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Secure & Reliable</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Enterprise-grade security with 99.9% uptime. Your codes are always available.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider">Testimonials</span>
            <h2 className="mt-2 text-4xl font-extrabold text-gray-900 dark:text-white">
              Loved by Thousands of Users
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-8 shadow-lg">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                    {testimonial.avatar}
                  </div>
                  <div className="ml-4">
                    <div className="font-bold text-gray-900 dark:text-white">{testimonial.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{testimonial.role}, {testimonial.company}</div>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400 italic">&ldquo;{testimonial.content}&rdquo;</p>
                <div className="flex mt-4 text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-extrabold text-white mb-6">
            Ready to Create Amazing QR Codes?
          </h2>
          <p className="text-xl text-white/90 mb-10">
            Join thousands of businesses using ScanMagic to connect with their customers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/register" 
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-indigo-600 bg-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
            >
              Start Free Trial
            </Link>
            <Link 
              href="/pricing" 
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white border-2 border-white rounded-xl hover:bg-white/10 transition-all duration-200"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
