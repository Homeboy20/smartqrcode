# Running the SmartQRCode App Locally

## Prerequisites
- Node.js 18.18.0 or later
- Git

## Setup Steps

1. **Clone the repository (if you haven't already)**
   ```
   git clone <your-repository-url>
   cd smartqrcode
   ```

2. **Install dependencies**
   ```
   npm install
   ```

3. **Set up environment variables**
   - Ensure your `.env.local` file contains all necessary Firebase configuration
   - Required environment variables:
     - NEXT_PUBLIC_FIREBASE_API_KEY
     - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
     - NEXT_PUBLIC_FIREBASE_PROJECT_ID
     - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
     - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
     - NEXT_PUBLIC_FIREBASE_APP_ID
     - NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID

4. **Run the development server**
   ```
   npm run dev
   ```

5. **Access the local site**
   - Open your browser and navigate to [http://localhost:3000](http://localhost:3000)

## Testing the Netlify Build Process Locally

If you want to test the Netlify build process locally:

1. **Install Netlify CLI**
   ```
   npm install netlify-cli -g
   ```

2. **Build the site**
   ```
   npm run netlify:build
   ```

3. **Serve the built site locally**
   ```
   netlify dev
   ```

## Common Issues

1. **Firebase Authentication Issues**
   - Make sure Firebase Authentication is properly configured in the Firebase Console
   - Verify localhost is added to authorized domains in Firebase Authentication settings

2. **Missing Environment Variables**
   - If you see Firebase-related errors, check that all environment variables are properly set

3. **Build Errors**
   - If you encounter build errors, try running `npm install` again to ensure dependencies are up to date
