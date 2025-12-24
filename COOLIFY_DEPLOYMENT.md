# Deploying SmartQRCode to Coolify

## Prerequisites

- A Coolify instance (self-hosted or cloud)
- Your Git repository accessible from Coolify
- Firebase project credentials

## Deployment Steps

### 1. Create New Resource in Coolify

1. Go to your Coolify dashboard
2. Click **"New Resource"** → **"Application"**
3. Select **"Docker Compose"** or **"Dockerfile"** as the build pack

### 2. Connect Your Repository

- Connect your GitHub/GitLab account or use a public repository URL
- Select the `smartqrcode` repository
- Branch: `main` (or your default branch)

### 3. Configure Build Settings

**If using Dockerfile:**
- Build Pack: `Dockerfile`
- Dockerfile Location: `Dockerfile`
- Port: `3000`

**If using Docker Compose:**
- Build Pack: `Docker Compose`
- Docker Compose Location: `docker-compose.yml`

### 4. Set Environment Variables

In Coolify's Environment Variables section, add:

#### Firebase Client (Build Args - REQUIRED)
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

#### Firebase Admin (Runtime - REQUIRED)
```
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

#### App URL (REQUIRED)
```
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

#### Payment Providers (Optional)
```
# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID_PRO=price_xxx
STRIPE_PRICE_ID_BUSINESS=price_xxx

# PayPal
PAYPAL_CLIENT_ID=xxx
PAYPAL_CLIENT_SECRET=xxx
PAYPAL_PLAN_ID_PRO=xxx
PAYPAL_PLAN_ID_BUSINESS=xxx

# Flutterwave
FLUTTERWAVE_PUBLIC_KEY=xxx
FLUTTERWAVE_SECRET_KEY=xxx
FLUTTERWAVE_ENCRYPTION_KEY=xxx
```

### 5. Configure Domain

1. In Coolify, go to **"Domains"** tab
2. Add your custom domain (e.g., `qrcode.yourdomain.com`)
3. Enable **"Generate SSL Certificate"** for HTTPS

### 6. Deploy

Click **"Deploy"** and wait for the build to complete.

## Troubleshooting

### Build Fails with "output: standalone" Error
Make sure `next.config.js` has `output: 'standalone'` enabled.

### Firebase Admin Not Working
- Ensure `FIREBASE_PRIVATE_KEY` is wrapped in quotes
- Keep the `\n` newline characters in the private key
- Verify the service account has proper permissions

### Environment Variables Not Loading
- In Coolify, mark `NEXT_PUBLIC_*` variables as **"Build Time"** variables
- Mark server-side variables (without `NEXT_PUBLIC_` prefix) as **"Runtime"** variables

### Port Issues
- Ensure port `3000` is exposed and mapped correctly
- Check Coolify's proxy settings

## Health Check

After deployment, verify:
1. Visit `https://your-domain.com` - should load the homepage
2. Try to sign up/login - Firebase Auth should work
3. Visit `/admin` - should redirect to login or show admin panel

## Creating Your First Admin User

### Method 1: Secure Setup Page (Recommended)

1. **Add setup secret to Coolify environment variables:**
   ```
   ADMIN_SETUP_SECRET=your-random-secret-key-here
   ```
   (Generate a random string, e.g., `openssl rand -hex 32`)

2. **Redeploy the app** for the new env var to take effect

3. **Go to** `https://your-domain.com/secure-admin-setup`

4. **Sign up or log in** with your account

5. **Enter the secret key** and click "Make Me Admin"

6. **Sign out and sign back in** for the role to take effect

7. **Remove the `ADMIN_SETUP_SECRET`** from Coolify and redeploy (for security)

### Method 2: Firebase Console (Manual)

1. Go to [Firebase Console](https://console.firebase.google.com/project/smartqrdatabase-b5076/firestore)
2. Navigate to **Firestore Database** → `users` collection
3. Create or edit your user document with:
   - Document ID: Your Firebase Auth UID
   - Field: `role` = `admin`

### Method 3: Using Firebase Admin Script

Run locally with your service account:
```bash
node scripts/create-admin.mjs
```

## Updates

To deploy updates:
1. Push changes to your Git repository
2. Coolify will auto-deploy (if configured) or manually trigger deployment
