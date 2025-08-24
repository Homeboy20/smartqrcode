/**
 * Modified Firebase configuration check.
 *
 * This version loosens the build-time restrictions around environment variables.
 * Instead of failing the build when required Firebase variables are undefined,
 * it logs warnings and proceeds. This helps prevent Netlify deployments from
 * aborting when you intend to inject configuration later via the Netlify UI.
 */

// Load environment variables from .env.local if present
try {
  require('dotenv').config({ path: '.env.local' });
} catch (err) {
  // If dotenv isn't installed or the file doesn't exist, continue silently
}

// Firebase environment variables that should be defined
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID'
];

// Optional Firebase environment variables
const optionalEnvVars = [
  'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID'
];

// Check if an environment variable is defined
function checkEnvVar(varName, isRequired = true) {
  const value = process.env[varName];
  const isDefined = typeof value === 'string' && value.trim() !== '';

  if (!isDefined && isRequired) {
    console.warn(`⚠️ Required environment variable ${varName} is not defined!`);
    return false;
  }

  if (!isDefined && !isRequired) {
    console.warn(`⚠️ Optional environment variable ${varName} is not defined.`);
  } else {
    console.log(`✅ ${isRequired ? 'Required' : 'Optional'} environment variable ${varName} is defined.`);
  }

  return true;
}

// Determine whether we’re in a production/build environment
const isBuildEnv = process.env.NODE_ENV === 'production' || process.env.STATIC_EXPORT_ONLY === 'true';
console.log(`Environment: ${isBuildEnv ? 'Production/Build' : 'Development'}`);

let missingRequired = false;

// Check required environment variables
for (const envVar of requiredEnvVars) {
  if (!checkEnvVar(envVar, true)) {
    missingRequired = true;
  }
}

// Check optional environment variables
for (const envVar of optionalEnvVars) {
  checkEnvVar(envVar, false);
}

// If required variables are missing, warn but do not exit.
if (missingRequired) {
  console.warn('⚠️ Missing required Firebase configuration environment variables!');
  console.warn('The build will continue, but some services may not function properly.');
  console.warn('Please ensure these variables are defined in your deployment environment (e.g., Netlify UI).');
} else {
  console.log('✅ All Firebase configuration environment variables are properly set.');
}
