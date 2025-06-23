/**
 * Script to check Firebase configuration before building
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
    console.error(`❌ Required environment variable ${varName} is not defined!`);
    return false;
  }
  
  if (!isDefined && !isRequired) {
    console.warn(`⚠️ Optional environment variable ${varName} is not defined.`);
  } else {
    console.log(`✅ ${isRequired ? 'Required' : 'Optional'} environment variable ${varName} is defined.`);
  }
  
  return true;
}

// Check if we're in a build environment
const isBuildEnv = process.env.NODE_ENV === 'production' || process.env.STATIC_EXPORT_ONLY === 'true';
console.log(`Environment: ${isBuildEnv ? 'Production/Build' : 'Development'}`);

// For build environment, we'll warn but continue if env vars are missing
// For development, we'll fail
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

// Exit with error code if missing required vars in development
if (missingRequired && !isBuildEnv) {
  console.error('❌ Missing required Firebase configuration environment variables!');
  console.error('Please add them to your .env.local file or deployment environment.');
  process.exit(1);
} else if (missingRequired && isBuildEnv) {
  console.warn('⚠️ Missing Firebase configuration environment variables during build.');
  console.warn('The build will continue, but make sure stub handling is implemented properly.');
  console.warn('This may cause runtime errors if Firebase services are not properly mocked/stubbed.');
} else {
  console.log('✅ All Firebase configuration environment variables are properly set.');
}
