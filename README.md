# Smart QR Code & Barcode Generator

[![Netlify Status](https://api.netlify.com/api/v1/badges/YOUR-NETLIFY-APP-ID/deploy-status)](https://app.netlify.com/sites/YOUR-NETLIFY-APP-NAME/deploys)

A web application that allows users to generate QR codes and barcodes with customizable options. Built with Next.js, React, and Tailwind CSS.

![Smart QR Code & Barcode Generator](https://github.com/yourusername/smartqrcode/assets/screenshot.png)

## Live Demo

[Visit the live demo](https://smartqrcode.netlify.app)

## Features

- **QR Code Generation**: Create QR codes for URLs, text, contact information, and more
- **Barcode Generation**: Generate barcodes in various formats (CODE128, UPC, EAN, etc.)
- **Customization Options**: Modify colors, size, and other parameters
- **High-Quality Downloads**: Save generated codes as PNG images
- **No Registration Required**: Free to use without creating an account
- **Responsive Design**: Works on desktop and mobile devices

## Technologies Used

- **Next.js**: React framework for server-rendered applications
- **React**: JavaScript library for building user interfaces
- **TypeScript**: Typed JavaScript for better development experience
- **Tailwind CSS**: Utility-first CSS framework
- **qrcode & react-qr-code**: Libraries for QR code generation
- **jsbarcode**: Library for barcode generation

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/smartqrcode.git
   cd smartqrcode
   ```

2. Install dependencies
   ```bash
   npm install
   # or
   yarn install
   ```

3. Run the development server
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application

## Deployment to Netlify via GitHub

### Prerequisites

- GitHub repository with your code
- Netlify account
- Firebase project (for authentication and database)

### Step 1: Push Your Code to GitHub

Ensure your code is pushed to a GitHub repository:

```bash
git add .
git commit -m "Prepare for Netlify deployment"
git push origin main
```

### Step 2: Connect to Netlify

1. Log in to your Netlify account
2. Click "New site from Git"
3. Select GitHub as your provider
4. Authorize Netlify to access your GitHub account
5. Select your repository

### Step 3: Configure Build Settings

The repository includes a `netlify.toml` file that configures:

- **Build command**: `npm run build`
- **Publish directory**: `out`
- **Node version**: 18

You don't need to change these settings unless you have specific requirements.

### Step 4: Set Environment Variables

Set the following environment variables in Netlify dashboard (Site settings > Build & deploy > Environment):

**Firebase Configuration (Required):**
- `NEXT_PUBLIC_FIREBASE_API_KEY` - Firebase API key (regenerate this in Google Cloud Console)
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` - Firebase Auth domain
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` - Firebase project ID
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `NEXT_PUBLIC_FIREBASE_APP_ID` - Firebase app ID
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` - Firebase measurement ID

**Stripe Configuration (For Payments):**
- `STRIPE_SECRET_KEY` - Stripe secret key (starts with `sk_`)
- `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` - Stripe publishable key (starts with `pk_`)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `STRIPE_PRICE_ID_PRO` - Stripe Price ID for Pro tier
- `STRIPE_PRICE_ID_BUSINESS` - Stripe Price ID for Business tier

**PayPal Configuration (For Payments):**
- `PAYPAL_CLIENT_ID` - PayPal client ID
- `PAYPAL_CLIENT_SECRET` - PayPal client secret
- `PAYPAL_PLAN_ID_PRO` - PayPal plan ID for Pro tier
- `PAYPAL_PLAN_ID_BUSINESS` - PayPal plan ID for Business tier

**Flutterwave Configuration (For Payments):**
- `FLUTTERWAVE_CLIENT_ID` - Flutterwave V4 client ID
- `FLUTTERWAVE_CLIENT_SECRET` - Flutterwave V4 client secret
- `FLUTTERWAVE_ENCRYPTION_KEY` - Flutterwave encryption key

**Application Configuration:**
- `NEXT_PUBLIC_APP_URL` - Your Netlify URL (e.g., https://your-app-name.netlify.app)

### Payment Gateway Setup

For the paid features to work, you need to set up the payment gateways:

**Stripe Setup:**
1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Set up your products and price plans in the Stripe dashboard
3. Get your API keys from the Stripe dashboard
4. Set up a webhook endpoint that points to your Netlify site: `https://your-netlify-site.netlify.app/.netlify/functions/stripe-webhook`
5. Add the webhook signing secret to your environment variables

**PayPal Setup:**
1. Create a PayPal Developer account at [developer.paypal.com](https://developer.paypal.com)
2. Create a PayPal application to get your client ID and secret
3. Set up subscription plans in the PayPal dashboard
4. Add the plan IDs to your environment variables

**Flutterwave Setup (for African regions):**
1. Create a Flutterwave account at [flutterwave.com](https://flutterwave.com)
2. Get your API keys from the Flutterwave dashboard
3. Add the keys to your environment variables

### Step 5: Deploy

Click "Deploy site" and Netlify will build and deploy your application.

### Local Deployment Preparation

You can use the included script to prepare your project for deployment:

```bash
# On Windows
netlify-deploy.bat

# On Linux/Mac
# Run the equivalent commands:
# rm -rf .next out
# npm ci
# npm run build
```

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgments

- [qrcode](https://github.com/soldair/node-qrcode) for QR code generation
- [react-qr-code](https://github.com/rosskhanas/react-qr-code) for React QR code component
- [jsbarcode](https://github.com/lindell/JsBarcode) for barcode generation
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Next.js](https://nextjs.org/) for the framework

## Build Requirements

This project has specific requirements for successful builds:

- **Node.js Version**: Requires Node.js v18.x - v21.x. Using versions outside this range may cause build failures.
- **Firebase Configuration**: All required Firebase environment variables must be properly set.
- **Environment Variables**: The application expects certain environment variables to be defined in `.env.local` or in your deployment environment.

### Troubleshooting Build Failures

If you encounter build errors, check the following:

1. **Node.js Version**: Run `node -v` to verify you're using a compatible Node.js version (v18-v21 recommended).
2. **Missing Environment Variables**: Make sure all required environment variables are defined.
3. **Firebase Initialization**: The app uses Firebase services that require proper configuration.

For production builds, make sure your deployment environment (Vercel, Netlify, etc.) is configured with:
- The correct Node.js version (set in `.nvmrc`)
- All required environment variables
