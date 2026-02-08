const { loadEnvConfig } = require('@next/env');

// Load environment variables from .env.* files
const projectDir = process.cwd();
loadEnvConfig(projectDir);

function hostnameFromUrl(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const supabaseHost = hostnameFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Enable standalone output for Docker deployment (Coolify)
  output: 'standalone',

  images: {
    // We do NOT use Next Image Optimization in this app (local uploads + direct URLs).
    // Keeping this disabled reduces attack surface of the image optimizer.
    unoptimized: true,

    // SECURITY: Avoid wide wildcard remotePatterns (can contribute to optimizer abuse/DoS).
    // If you must allow external images, prefer explicit hostnames.
    remotePatterns: [
      ...(supabaseHost
        ? [
            {
              protocol: 'https',
              hostname: supabaseHost,
            },
          ]
        : []),
    ],
  },

  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()'
          },
          ...(isProd
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000; includeSubDomains; preload',
                },
              ]
            : []),
        ],
      },
    ];
  },

  // Trailing-slash redirects can break POST /api/* on some hosts
  // by redirecting to a path that isn't routed for the server.
  trailingSlash: false,

  assetPrefix: process.env.NODE_ENV === 'production' ? '/' : '',

  distDir: '.next',
  excludeDefaultMomentLocales: true,

  // NOTE: NEXT_PUBLIC_* variables are automatically exposed by Next.js.
  // Avoid putting secrets here.
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    NEXT_PUBLIC_GIT_SHA:
      process.env.COMMIT_REF ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.GITHUB_SHA ||
      'dev',
  },

  typescript: {
    // SECURITY: don’t silently ship with type errors.
    // You can temporarily override by setting NEXT_IGNORE_TYPECHECK=true.
    ignoreBuildErrors: process.env.NEXT_IGNORE_TYPECHECK === 'true',
  },
};

module.exports = nextConfig;
