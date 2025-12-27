import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import ClientLayout from './client-layout'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#4f46e5',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://scanmagic.online'),
  title: {
    default: 'Free QR Code Generator Online | Create QR Codes & Barcodes - ScanMagic',
    template: '%s | ScanMagic - QR Code Generator',
  },
  description: 'Create free QR codes and barcodes online instantly. Generate custom QR codes for URLs, WiFi, vCards, text, and more. Download in PNG, SVG, JPEG. No signup required. Professional quality for business cards, marketing, and products.',
  keywords: [
    'QR code generator',
    'free QR code maker',
    'barcode generator',
    'create QR code',
    'QR code creator',
    'online QR code',
    'custom QR code',
    'QR code for URL',
    'WiFi QR code',
    'vCard QR code',
    'bulk QR codes',
    'CODE128 barcode',
    'EAN barcode',
    'UPC barcode',
    'QR code download PNG',
    'QR code download SVG',
    'free barcode maker',
    'business card QR code',
    'menu QR code',
    'product barcode',
  ],
  authors: [{ name: 'ScanMagic', url: 'https://scanmagic.online' }],
  creator: 'ScanMagic',
  publisher: 'ScanMagic',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://scanmagic.online',
    siteName: 'ScanMagic',
    title: 'Free QR Code Generator Online | Create QR Codes & Barcodes Instantly',
    description: 'Create free QR codes and barcodes online. Generate custom QR codes for URLs, WiFi, vCards, business cards, and more. Download in PNG, SVG, JPEG. No signup required.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ScanMagic - Free QR Code & Barcode Generator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free QR Code Generator | Create QR Codes & Barcodes Online',
    description: 'Create free QR codes and barcodes instantly. Custom colors, multiple formats, no signup required. Perfect for business cards, marketing, and products.',
    images: ['/og-image.png'],
    creator: '@scanmagic',
  },
  alternates: {
    canonical: 'https://scanmagic.online',
  },
  category: 'technology',
  classification: 'Business Tools',
  other: {
    'google-site-verification': 'your-verification-code',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body 
        className={`${inter.className} bg-zinc-100 text-gray-800 flex flex-col min-h-screen`}
        suppressHydrationWarning
      >
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  )
}
