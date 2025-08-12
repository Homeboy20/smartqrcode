# Netlify Deployment Guide

This project is now configured for successful deployment on Netlify.

## Quick Setup

1. **Connect Repository**: Connect your GitHub repository to Netlify
2. **Build Settings**: The build settings are already configured in `netlify.toml`:
   - Build command: `node scripts/netlify-build.js`
   - Publish directory: `out`
   - Node version: 20

3. **Environment Variables**: Set these in Netlify dashboard under "Site settings" > "Environment variables":
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id (optional)
   ```

## What the Build Does

The custom `scripts/netlify-build.js` script:
- Temporarily excludes admin routes and API routes during build
- Generates static pages for all public routes
- Creates placeholder pages for excluded routes that redirect to home
- Restores all routes after build completion
- Generates proper `_redirects` file for client-side routing

## Build Output

The build generates:
- ✅ 31+ static HTML pages
- ✅ Optimized CSS and JavaScript bundles
- ✅ Client-side routing configuration
- ✅ Proper font loading without build-time network dependencies

## Deployment Features

- **Static Export**: All public pages are pre-rendered
- **Client-side Routing**: Admin and authenticated routes work client-side
- **Firebase Integration**: Full Firebase authentication and database support
- **Payment Processing**: Stripe, PayPal, and Flutterwave integration ready
- **QR Code Generation**: All QR code and barcode functionality included

## Local Development

1. Install dependencies: `npm install`
2. Copy environment variables: `cp .env.example .env.local`
3. Update `.env.local` with your Firebase config
4. Run development server: `npm run dev`

## Testing the Build

To test the build locally:
```bash
npm run netlify:build
npx serve out
```

This will build the project and serve it locally to verify everything works correctly before deploying to Netlify.