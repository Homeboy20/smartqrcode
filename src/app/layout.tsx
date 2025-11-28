import './globals.css'
import type { Metadata } from 'next'
import ClientLayout from './client-layout'

export const metadata: Metadata = {
  title: 'ScanMagic - QR Code & Barcode Generator',
  description: 'Create stunning QR codes and barcodes instantly. Track scans, customize designs, and grow your business with the most powerful code generator.',
  keywords: 'qr code generator, barcode generator, dynamic qr codes, qr code tracking, bulk qr codes',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body 
        className="bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 flex flex-col min-h-screen font-sans antialiased"
        suppressHydrationWarning
      >
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  )
}
