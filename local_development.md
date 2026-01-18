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

## Supabase Edge Functions (Contact System)

The `/contact` form and `/admin/contact-messages` viewer call Supabase Edge Functions.

### Prerequisites
- Supabase CLI installed: `npm i -g supabase`
- Logged in: `supabase login`
- Linked to the correct project: `supabase link --project-ref <PROJECT_REF>`

### Deploy functions
Deploy after changing anything under `supabase/functions/**`:

```
supabase functions deploy submit-contact
supabase functions deploy admin-contact-messages
supabase functions deploy process-contact-outbox
supabase functions deploy purge-contact-data
```

### Required secrets

```
supabase secrets set CONTACT_IP_PEPPER="change-me-long-random-string"
supabase secrets set CONTACT_RETENTION_DAYS="180"
supabase secrets set CONTACT_AUDIT_RETENTION_DAYS="365"
```

If you enable email notifications (outbox worker):

```
supabase secrets set RESEND_API_KEY="..."
supabase secrets set CONTACT_NOTIFY_TO="support@scanmagic.online"
supabase secrets set CONTACT_NOTIFY_FROM="ScanMagic <noreply@scanmagic.online>"
```

If you see CORS errors in the browser, it usually means the deployed function code is out of date and needs redeploying.

## Testing a Production Build Locally

To validate that SSR + API routes work end-to-end, run a production build locally:

1. **Build**
   ```
   npm run build
   ```

2. **Start**
   ```
   npm start
   ```

## Common Issues

1. **Firebase Authentication Issues**
   - Make sure Firebase Authentication is properly configured in the Firebase Console
   - Verify localhost is added to authorized domains in Firebase Authentication settings

2. **Missing Environment Variables**
   - If you see Firebase-related errors, check that all environment variables are properly set

3. **Build Errors**
   - If you encounter build errors, try running `npm install` again to ensure dependencies are up to date 