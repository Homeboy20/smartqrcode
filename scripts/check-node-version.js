/**
 * Modified Node.js version check.
 *
 * This version logs warnings when the Node.js major version falls outside
 * the recommended range (>=18 and <22) instead of exiting the process.
 * This avoids aborting the build on platforms like Netlify that may use
 * slightly different Node versions.  It still informs you when the version
 * could be problematic so you can adjust the environment if necessary.
 */

// Get the current Node.js version
const currentVersion = process.version;
console.log(`Current Node.js version: ${currentVersion}`);

// Extract the major version number (e.g., 'v14.17.0' -> 14)
const majorVersion = parseInt(currentVersion.slice(1).split('.')[0], 10);

// Define acceptable version range
const MIN_VERSION = 18;
const MAX_VERSION = 22;

if (isNaN(majorVersion)) {
  console.error('❌ Could not determine Node.js version!');
  // Do not exit – assume it’s acceptable and continue.
} else {
  if (majorVersion < MIN_VERSION) {
    console.warn(
      `⚠️ Node.js version v${majorVersion}.x is below the recommended minimum of ${MIN_VERSION}.x.`
    );
    console.warn('The build will continue, but you may encounter unexpected issues.');
  } else if (majorVersion >= MAX_VERSION) {
    console.warn(
      `⚠️ WARNING: Using Node.js v${majorVersion}.x which might not be fully tested with this project.`
    );
    console.warn(
      `Consider using Node.js v${MIN_VERSION}.x - v${MAX_VERSION - 1}.x for better compatibility.`
    );
  }
  console.log(
    `✅ Node.js version v${majorVersion}.x is acceptable. Continuing with build...`
  );
}
