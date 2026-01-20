"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useSupabaseAuth } from "@/context/SupabaseAuthContext";
import { useGeoCurrencyInfo } from '@/hooks/useGeoCurrencyInfo';
import { subscriptionFeatures } from '@/lib/subscriptions';

function formatCurrency(amount: number, currencyCode: string): string {
  if (!Number.isFinite(amount)) return '';
  const code = String(currencyCode || '').toUpperCase();
  if (!code || !/^[A-Z]{3}$/.test(code)) return String(amount);

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: code === 'JPY' ? 0 : 2,
    }).format(amount);
  } catch {
    return String(amount);
  }
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

function PlanActionRow(props: {
  label: string;
  price: string;
  hint?: string;
  href: string;
  primary?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-900">{props.label}</p>
          {props.hint ? (
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">
              {props.hint}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-gray-600 truncate">{props.price}</p>
      </div>
      <Link
        href={props.href}
        className={
          props.primary
            ? 'inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition'
            : 'inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100 transition'
        }
      >
        Select
      </Link>
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
  const { settings: appSettings, loading: settingsLoading } = useAppSettings();
  const { user } = useSupabaseAuth();
  const { geo, countryName } = useGeoCurrencyInfo();

  const ctaHref = user ? '/dashboard#generator' : '/register/';
  const ctaLabel = user ? 'Open Dashboard Generator' : 'Create an Account';

  const geoCode = String(geo?.country || '').toUpperCase();
  const geoCurrency = geo?.currency?.code;
  const geoProvider = geo?.recommendedProvider;

  const trialDays = geo?.paidTrial?.days ?? 7;

  const pricing = useMemo(() => {
    const currency = geoCurrency || 'USD';

    const proMonthlyAmount = geo?.pricing?.pro?.amount ?? 9.99;
    const bizMonthlyAmount = geo?.pricing?.business?.amount ?? 29.99;

    const proYearlyAmount = geo?.pricingYearly?.pro?.amount;
    const bizYearlyAmount = geo?.pricingYearly?.business?.amount;

    const proTrialAmount = geo?.pricingTrial?.pro?.amount;
    const bizTrialAmount = geo?.pricingTrial?.business?.amount;

    const proMonthly = geo?.pricing?.pro?.formatted || formatCurrency(proMonthlyAmount, currency);
    const bizMonthly = geo?.pricing?.business?.formatted || formatCurrency(bizMonthlyAmount, currency);

    const proYearly = geo?.pricingYearly?.pro?.formatted || (proYearlyAmount ? formatCurrency(proYearlyAmount, currency) : '');
    const bizYearly = geo?.pricingYearly?.business?.formatted || (bizYearlyAmount ? formatCurrency(bizYearlyAmount, currency) : '');

    const proTrial = geo?.pricingTrial?.pro?.formatted || (proTrialAmount ? formatCurrency(proTrialAmount, currency) : '');
    const bizTrial = geo?.pricingTrial?.business?.formatted || (bizTrialAmount ? formatCurrency(bizTrialAmount, currency) : '');

    const proYearlyPerMonth = proYearlyAmount ? formatCurrency(proYearlyAmount / 12, currency) : '';
    const bizYearlyPerMonth = bizYearlyAmount ? formatCurrency(bizYearlyAmount / 12, currency) : '';

    const proYearlySave =
      proYearlyAmount && Number.isFinite(proMonthlyAmount)
        ? formatCurrency(proMonthlyAmount * 12 - proYearlyAmount, currency)
        : '';
    const bizYearlySave =
      bizYearlyAmount && Number.isFinite(bizMonthlyAmount)
        ? formatCurrency(bizMonthlyAmount * 12 - bizYearlyAmount, currency)
        : '';

    return {
      currency,
      pro: {
        monthly: proMonthly,
        yearly: proYearly,
        trial: proTrial,
        yearlyPerMonth: proYearlyPerMonth,
        yearlySave: proYearlySave,
      },
      business: {
        monthly: bizMonthly,
        yearly: bizYearly,
        trial: bizTrial,
        yearlyPerMonth: bizYearlyPerMonth,
        yearlySave: bizYearlySave,
      },
    };
  }, [geoCurrency, geo?.pricing, geo?.pricingYearly, geo?.pricingTrial]);

  const marketing = (() => {
    const isAfrica = ['NG','GH','KE','ZA','TZ','UG','RW','ZM'].includes(geoCode);

    const headlineTail = countryName ? `for ${countryName}` : 'for your business';
    const sub = isAfrica
      ? `Create QR codes and barcodes designed for local scanning habits. Pay with ${geoProvider ? geoProvider : 'popular gateways'} and see pricing in ${geoCurrency || 'your currency'}.`
      : `Create QR codes and barcodes that look professional on menus, packaging, and business cards. See pricing in ${geoCurrency || 'your currency'}.`;

    const trust = isAfrica
      ? ['Mobile-money friendly', 'Fast checkout', 'Works on low-end phones']
      : ['High-resolution downloads', 'Brand customization', 'Works for print + web'];

    return { headlineTail, sub, trust };
  })();

  const localized = (() => {
    const defaultUseCases = [
      { icon: '🍽️', title: 'Restaurant menus', description: 'QR menus and table ordering links that look great on print.' },
      { icon: '🛍️', title: 'Product labels', description: 'Add QR codes to packaging for manuals, warranty, and reviews.' },
      { icon: '🎫', title: 'Events & tickets', description: 'Share check-in links and schedules with scannable codes.' },
      { icon: '🏪', title: 'Retail & inventory', description: 'Generate barcodes for SKUs and fast scanning workflows.' },
    ];

    const africaUseCases = [
      { icon: '📲', title: 'WhatsApp sharing', description: 'One-tap QR links to WhatsApp chats and broadcasts.' },
      { icon: '💳', title: 'Mobile-money payments', description: `Smooth checkout with ${geoProvider ? geoProvider : 'local gateways'} where supported.` },
      { icon: '🏬', title: 'Small business marketing', description: 'Flyers, posters, and storefront codes that convert.' },
      { icon: '🧾', title: 'Receipts & invoices', description: 'Attach QR codes to invoices for payment and support links.' },
    ];

    const isAfrica = ['NG','GH','KE','ZA','TZ','UG','RW','ZM'].includes(geoCode);
    const extraUseCases = [
      { icon: '📶', title: 'WiFi access', description: 'Add a WiFi QR code to your shop, office, or Airbnb.' },
      { icon: '💼', title: 'Digital business cards', description: 'Share contact details and social profiles instantly.' },
      { icon: '📦', title: 'Shipping labels', description: 'Use barcodes/QR for tracking and warehouse flows.' },
      { icon: '🏥', title: 'Healthcare labels', description: 'Create scannable IDs and equipment labels.' },
    ];

    const useCases = [...(isAfrica ? africaUseCases : defaultUseCases), ...extraUseCases].slice(0, 8);

    const testimonial = (() => {
      if (geoCode === 'TZ') return { quote: 'We printed table QR menus in one afternoon. Customers loved it.', name: 'Restaurant owner', location: 'Tanzania' };
      if (geoCode === 'NG') return { quote: 'Our product labels look premium and scanning works everywhere.', name: 'E-commerce seller', location: 'Nigeria' };
      if (geoCode === 'KE') return { quote: 'Fast to generate, easy to download, and clients trust the look.', name: 'Marketing consultant', location: 'Kenya' };
      if (geoCode === 'GB' || geoCode === 'US') return { quote: 'Clean QR codes for packaging and brochures — exactly what we needed.', name: 'Operations manager', location: geoCode === 'GB' ? 'United Kingdom' : 'United States' };
      return { quote: 'Simple setup, professional results. We launched in minutes.', name: 'Small business', location: countryName || 'Your region' };
    })();

    return { useCases, testimonial };
  })();
  
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-yellow-300 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 py-14 sm:py-20 lg:py-28 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 text-center lg:text-left">
            {!!geo?.currency?.code && !!geo?.country && (
              <div className="inline-flex items-center justify-center lg:justify-start gap-2 bg-white/10 backdrop-blur text-white px-5 py-2 rounded-full font-semibold text-sm mb-6 shadow-lg border border-white/20">
                <span>
                  {countryName ? `Popular in ${countryName}` : 'Popular in your region'}
                </span>
                <span className="text-white/60">•</span>
                <span>
                  Local pricing: {geo.currency.code}
                </span>
                {geo.recommendedProvider && (
                  <>
                    <span className="text-white/60">•</span>
                    <span className="capitalize">Pay with {geo.recommendedProvider}</span>
                  </>
                )}
              </div>
            )}
            {!user && (
              <div className="inline-flex items-center bg-yellow-400 text-gray-900 px-4 py-2 rounded-full font-bold text-sm mb-6 shadow-lg">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Create an account to generate & manage codes
              </div>
            )}
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight">
              Sell more with scannable
              <span className="block text-yellow-400 mt-2">QR codes & barcodes {marketing.headlineTail}</span>
            </h1>
            <p className="mt-6 max-w-2xl mx-auto lg:mx-0 text-lg sm:text-xl text-indigo-100 leading-relaxed">
              {marketing.sub}
            </p>

            <p className="mt-5 text-sm text-indigo-200">
              {pricing?.pro?.monthly ? (
                <>
                  Plans start at <span className="font-semibold text-white">{pricing.pro.monthly}</span>/month.
                  {pricing.pro.yearlyPerMonth ? (
                    <> Save 2 months with yearly (≈ <span className="font-semibold text-white">{pricing.pro.yearlyPerMonth}</span>/mo).</>
                  ) : null}
                </>
              ) : null}
            </p>
            
            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link 
                href={ctaHref}
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-indigo-900 bg-yellow-400 rounded-xl hover:bg-yellow-300 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {ctaLabel}
                <svg className="ml-2 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link 
                href="/pricing/" 
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-white/10 backdrop-blur rounded-xl hover:bg-white/20 transition-all border border-white/20"
              >
                View Pricing Plans
              </Link>
            </div>
            
            {/* Trust indicators */}
            <div className="mt-10 flex flex-wrap justify-center lg:justify-start gap-6 text-indigo-200 text-sm">
              {marketing.trust.map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {t}
                </div>
              ))}
            </div>

            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur p-6 shadow-2xl">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-white font-bold text-lg">Choose your plan</p>
                    <p className="text-indigo-100 text-sm">
                      {geoCurrency ? `Prices in ${geoCurrency}` : 'Local pricing available'}
                      {geoProvider ? ` • Pay with ${geoProvider}` : ''}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-yellow-900 bg-yellow-300/90 rounded-full px-3 py-1">
                    Best value: Yearly
                  </span>
                </div>

                <div className="mt-6 space-y-3">
                  <PlanActionRow
                    label={`Pro trial (${trialDays} days)`}
                    price={pricing?.pro?.trial ? `${pricing.pro.trial} one-time • no auto-renew` : 'Pay less to try Pro'}
                    hint="Paid trial"
                    href={`/checkout?plan=pro&billingInterval=trial`}
                  />
                  <PlanActionRow
                    label="Pro monthly"
                    price={pricing?.pro?.monthly ? `${pricing.pro.monthly}/month` : 'Monthly subscription'}
                    href={`/checkout?plan=pro&billingInterval=monthly`}
                  />
                  <PlanActionRow
                    label="Pro yearly"
                    price={
                      pricing?.pro?.yearly && pricing?.pro?.yearlySave
                        ? `${pricing.pro.yearly}/year • save ${pricing.pro.yearlySave}`
                        : pricing?.pro?.yearly
                          ? `${pricing.pro.yearly}/year`
                          : 'Yearly subscription (2 months free)'
                    }
                    hint="Best value"
                    href={`/checkout?plan=pro&billingInterval=yearly`}
                    primary
                  />
                </div>

                <p className="mt-4 text-xs text-indigo-100">
                  Cancel anytime • 14-day money-back guarantee{' '}
                  <Link href="/refunds/" className="underline underline-offset-2 hover:text-white">
                    (see policy)
                  </Link>
                </p>

                <div className="mt-6 rounded-xl border border-white/15 bg-white/5 p-4">
                  <p className="text-white font-semibold">Need a team?</p>
                  <p className="text-indigo-100 text-sm mt-1">
                    Business plan adds team access and higher limits.
                  </p>
                  <div className="mt-3 flex flex-col sm:flex-row gap-3">
                    <Link
                      href={`/checkout?plan=business&billingInterval=yearly`}
                      className="inline-flex items-center justify-center rounded-lg bg-white text-indigo-900 px-4 py-2 text-sm font-semibold hover:bg-indigo-50 transition"
                    >
                      Business yearly
                    </Link>
                    <Link
                      href="/pricing/"
                      className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition"
                    >
                      Compare plans
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Proof Bar */}
      <section className="py-10 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
              <span className="text-2xl">🖼️</span>
              <div>
                <p className="font-semibold text-gray-900">Export-ready</p>
                <p className="text-sm text-gray-600">PNG, SVG, JPEG for web + print</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
              <span className="text-2xl">🏷️</span>
              <div>
                <p className="font-semibold text-gray-900">Barcodes included</p>
                <p className="text-sm text-gray-600">EAN/UPC/CODE128 and more</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
              <span className="text-2xl">📦</span>
              <div>
                <p className="font-semibold text-gray-900">Bulk generation</p>
                <p className="text-sm text-gray-600">Batches + ZIP downloads</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
              <span className="text-2xl">📈</span>
              <div>
                <p className="font-semibold text-gray-900">Manage & track</p>
                <p className="text-sm text-gray-600">Edit destinations + analytics (Pro+)</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Local Use Cases */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-indigo-600 font-semibold text-sm uppercase tracking-wider">
              Built for your market
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
              Use cases that convert{countryName ? ` in ${countryName}` : ''}
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Menus, packaging, payments, tickets, inventory — build scannable flows that customers actually use.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {localized.useCases.map((u) => (
              <UseCaseCard key={u.title} icon={u.icon} title={u.title} description={u.description} />
            ))}
          </div>

          <div className="mt-12 flex justify-center">
            <div className="max-w-3xl w-full rounded-2xl border border-gray-200 bg-gradient-to-r from-indigo-50 to-white p-6 sm:p-8">
              <p className="text-lg sm:text-xl font-semibold text-gray-900">
                “{localized.testimonial.quote}”
              </p>
              <p className="mt-3 text-sm text-gray-600">
                — {localized.testimonial.name} • {localized.testimonial.location}
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  href={ctaHref}
                  className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
                >
                  {ctaLabel}
                </Link>
                <Link
                  href="/pricing/"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50 font-semibold transition"
                >
                  See pricing{geoCurrency ? ` in ${geoCurrency}` : ''}
                </Link>
              </div>
            </div>
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
              description="Create codes for URLs, text, WiFi, vCards, and more — then manage them from your dashboard."
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
              title="Dashboard & Access Control"
              description="Keep your codes organized, reuse templates, and manage access as your team grows (Business)."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 sm:py-24 bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-indigo-600 font-semibold text-sm uppercase tracking-wider">Simple Process</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">From idea to scan in minutes</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">1</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Create an account</h3>
              <p className="text-gray-600">Access the dashboard generator and keep your codes organized.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">2</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Generate & download</h3>
              <p className="text-gray-600">Pick QR or barcode, customize styling, then export for print or web.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">3</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Manage & improve</h3>
              <p className="text-gray-600">Upgrade for analytics, dynamic edits, and team workflows.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Plans Preview */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-indigo-600 font-semibold text-sm uppercase tracking-wider">Pricing</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">Pick a plan that fits</h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Start with a paid trial, then switch to monthly or save with yearly.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Pro</h3>
                  <p className="text-sm text-gray-600 mt-1">For creators and growing businesses</p>
                </div>
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1">Most popular</span>
              </div>

              <div className="mt-5 space-y-2 text-sm text-gray-700">
                <p>• Up to {subscriptionFeatures.pro.maxQRCodes} QR codes</p>
                <p>• Up to {subscriptionFeatures.pro.maxBarcodes} barcodes</p>
                <p>• Bulk generation ({subscriptionFeatures.pro.maxBulkItems} items)</p>
                <p>• Analytics + custom branding</p>
              </div>

              <div className="mt-6 space-y-3">
                <PlanActionRow
                  label={`Trial (${trialDays} days)`}
                  price={pricing?.pro?.trial ? `${pricing.pro.trial} one-time • no auto-renew` : 'Paid trial • no auto-renew'}
                  hint="Try it"
                  href={`/checkout?plan=pro&billingInterval=trial`}
                />
                <PlanActionRow
                  label="Monthly"
                  price={pricing?.pro?.monthly ? `${pricing.pro.monthly}/month` : 'Monthly subscription'}
                  href={`/checkout?plan=pro&billingInterval=monthly`}
                />
                <PlanActionRow
                  label="Yearly"
                  price={
                    pricing?.pro?.yearly && pricing?.pro?.yearlySave
                      ? `${pricing.pro.yearly}/year • save ${pricing.pro.yearlySave}`
                      : pricing?.pro?.yearly
                        ? `${pricing.pro.yearly}/year`
                        : 'Yearly subscription (2 months free)'
                  }
                  hint="Best value"
                  href={`/checkout?plan=pro&billingInterval=yearly`}
                  primary
                />
              </div>

              <p className="mt-4 text-xs text-gray-600">
                Cancel anytime • 14-day money-back guarantee{' '}
                <Link href="/refunds/" className="text-indigo-700 hover:underline">
                  (details)
                </Link>
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Business</h3>
                  <p className="text-sm text-gray-600 mt-1">For teams and high-volume workflows</p>
                </div>
                <span className="text-xs font-semibold text-yellow-900 bg-yellow-100 border border-yellow-200 rounded-full px-3 py-1">Team-ready</span>
              </div>

              <div className="mt-5 space-y-2 text-sm text-gray-700">
                <p>• Up to {subscriptionFeatures.business.maxQRCodes} QR codes</p>
                <p>• Up to {subscriptionFeatures.business.maxBarcodes} barcodes</p>
                <p>• Bulk generation ({subscriptionFeatures.business.maxBulkItems} items)</p>
                <p>• Team members ({subscriptionFeatures.business.maxTeamMembers})</p>
              </div>

              <div className="mt-6 space-y-3">
                <PlanActionRow
                  label={`Trial (${trialDays} days)`}
                  price={pricing?.business?.trial ? `${pricing.business.trial} one-time • no auto-renew` : 'Paid trial • no auto-renew'}
                  hint="Try it"
                  href={`/checkout?plan=business&billingInterval=trial`}
                />
                <PlanActionRow
                  label="Monthly"
                  price={pricing?.business?.monthly ? `${pricing.business.monthly}/month` : 'Monthly subscription'}
                  href={`/checkout?plan=business&billingInterval=monthly`}
                />
                <PlanActionRow
                  label="Yearly"
                  price={
                    pricing?.business?.yearly && pricing?.business?.yearlySave
                      ? `${pricing.business.yearly}/year • save ${pricing.business.yearlySave}`
                      : pricing?.business?.yearly
                        ? `${pricing.business.yearly}/year`
                        : 'Yearly subscription (2 months free)'
                  }
                  hint="Best value"
                  href={`/checkout?plan=business&billingInterval=yearly`}
                  primary
                />
              </div>

              <p className="mt-4 text-xs text-gray-600">
                Cancel anytime • 14-day money-back guarantee{' '}
                <Link href="/refunds/" className="text-indigo-700 hover:underline">
                  (details)
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/pricing/"
              className="inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-6 py-3 font-semibold text-indigo-700 hover:bg-indigo-100 transition"
            >
              Compare all details
            </Link>
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
              question="Do I need an account to use ScanMagic?"
              answer="To keep the homepage fast and focused, the generator lives in the dashboard. Create an account to generate, save, and manage your QR codes and barcodes."
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
              answer="Static QR codes never expire. They are permanent once created. Dynamic QR codes in our premium plans can be edited anytime and include analytics."
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
            Ready to launch scannable marketing?
          </h2>
          <p className="text-xl text-indigo-100 mb-10 max-w-2xl mx-auto">
            Join thousands of businesses using ScanMagic{countryName ? ` in ${countryName}` : ''}. 
            Create professional codes in seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href={ctaHref}
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-indigo-900 bg-yellow-400 rounded-xl hover:bg-yellow-300 transition-all shadow-lg"
            >
              {ctaLabel}
            </Link>
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
            "name": "ScanMagic - QR Code Generator",
            "description": "QR code and barcode generator for menus, labels, marketing, and teams. Create and manage codes in your dashboard. Download in PNG, SVG, JPEG formats.",
            "url": "https://scanmagic.online",
            "applicationCategory": "UtilityApplication",
            "operatingSystem": "Any",
            "offers": {
              "@type": "Offer",
              "price": "9.99",
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
