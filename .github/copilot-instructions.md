# Copilot Instructions for Smart QR Code & Barcode Generator

## Project Overview

This is a Next.js web application for generating QR codes and barcodes with customizable options. The app is built with React, TypeScript, and Tailwind CSS, and uses Firebase for authentication and database services.

## Technology Stack

- **Framework**: Next.js 14.1.0 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI, Chakra UI, Lucide React icons
- **Authentication/Database**: Firebase, Firebase Admin SDK
- **Payment Integrations**: Stripe, PayPal, Flutterwave
- **QR/Barcode Libraries**: qrcode, react-qr-code, jsbarcode
- **Node.js Version**: 18.x - 21.x (specified in `.nvmrc` and `package.json`)

## Project Structure

```
src/
├── app/           # Next.js App Router pages and API routes
├── components/    # React components (QRCodeGenerator, BarcodeGenerator, etc.)
├── context/       # React context providers
├── hooks/         # Custom React hooks
├── lib/           # Utility functions, services, and Firebase configuration
```

## Coding Standards

### TypeScript
- Use strict TypeScript mode (configured in `tsconfig.json`)
- Define proper types for all function parameters and return values
- Use path aliases (`@/*` maps to `./src/*`)

### React/Next.js
- Use functional components with React hooks
- Follow Next.js App Router conventions for file-based routing
- Place API routes in `src/app/api/` directory
- Use server components by default, add `"use client"` directive only when needed

### Styling
- Use Tailwind CSS utility classes for styling
- Follow existing component patterns in `src/components/ui/`
- Use `clsx` and `tailwind-merge` for conditional class names

### Code Quality
- Run `npm run lint` before committing changes
- Follow the ESLint configuration in `eslint.config.mjs`
- Maintain consistent code formatting

## Build and Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Start production server
npm start
```

## Environment Variables

The application requires Firebase and payment provider configuration. Reference `.env.example` for required variables:

- `NEXT_PUBLIC_FIREBASE_*` - Firebase configuration
- `STRIPE_*` - Stripe payment configuration
- `PAYPAL_*` - PayPal payment configuration
- `FLUTTERWAVE_*` - Flutterwave payment configuration
- `NEXT_PUBLIC_APP_URL` - Application URL

## Key Files and Directories

- `src/app/layout.tsx` - Root layout component
- `src/app/page.tsx` - Home page
- `src/lib/firebase/` - Firebase configuration and utilities
- `src/lib/stripe.ts` - Stripe integration
- `src/lib/paypal.ts` - PayPal integration
- `src/lib/flutterwave.ts` - Flutterwave integration
- `src/components/QRCodeGenerator.tsx` - Main QR code generation component
- `src/components/BarcodeGenerator.tsx` - Barcode generation component

## Important Considerations

### Firebase
- Firebase Admin SDK is used for server-side operations
- Client-side Firebase is configured in `src/lib/firebase/`
- Firestore rules are defined in `firestore.rules`
- Storage rules are defined in `storage.rules`

### Payment Processing
- Support for multiple payment providers (Stripe, PayPal, Flutterwave)
- Subscription management is handled in `src/lib/subscription.ts`

### Static Export
- The app is configured for static export to Netlify
- Build configuration is in `netlify.toml`

## Testing

When making changes:
1. Run `npm run lint` to check for linting errors
2. Run `npm run build` to verify the build succeeds
3. Test the development server with `npm run dev`

## Deployment

- Primary deployment platform: Netlify
- Build command: `npm run build`
- Publish directory: `out`
- Node version: 18 (set in `.nvmrc`)
