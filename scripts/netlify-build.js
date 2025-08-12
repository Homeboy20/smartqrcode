/**
 * Custom build script for Netlify to handle static generation correctly
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Define sections to exclude from static generation
const excludedPaths = [
  'admin',
  'admin-login',
  'account',
  'auth',
  'dashboard',
  'checkout',
  'profile',
  'shared'
];

// Define dynamic routes that need special handling
const dynamicRoutes = [
  { route: 'shared/[id]', placeholder: 'placeholder' }
];

// Helper function to remove a directory recursively
function removeDirectory(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      console.log(`🗑️ Removing: ${dirPath}`);
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(`Failed to remove ${dirPath}:`, err);
  }
}

// Set environment variables for build
process.env.NEXT_DISABLE_ESLINT = '1';
process.env.NEXT_DISABLE_TYPE_CHECKS = '1';
process.env.NEXT_TELEMETRY_DISABLED = '1';

console.log("🔍 Node.js version:", process.version);
console.log("📂 Current directory:", process.cwd());

// First clean up any previous builds
console.log('🧹 Cleaning previous build artifacts...');
removeDirectory('.next');
removeDirectory('out');

// Move problematic admin routes temporarily
console.log('📁 Temporarily moving problematic admin routes...');
const adminPaths = [
  'src/app/admin',
  'src/app/admin-login', 
  'src/app/admin-setup',
  'src/app/api-admin-setup',
  'src/app/debug-auth',
  'src/app/api',
  'src/app/shared'
];

const tempPaths = [];
adminPaths.forEach(adminPath => {
  if (fs.existsSync(adminPath)) {
    const tempPath = adminPath.replace('src/app/', 'temp_build_') + '_excluded';
    if (fs.existsSync(tempPath)) {
      removeDirectory(tempPath);
    }
    fs.renameSync(adminPath, tempPath);
    tempPaths.push({ original: adminPath, temp: tempPath });
    console.log(`📦 Moved ${adminPath} to ${tempPath}`);
  }
});

// Create temporary generateStaticParams files for dynamic routes
console.log('📝 Creating temporary generateStaticParams for dynamic routes...');
dynamicRoutes.forEach(({ route }) => {
  const parts = route.split('/');
  const dirPath = path.join('src', 'app', ...parts);
  const filePath = path.join(dirPath, 'generateStaticParams.js');
  
  // Only create if the directory exists and file doesn't
  if (fs.existsSync(dirPath) && !fs.existsSync(filePath)) {
    console.log(`Creating temporary generateStaticParams at ${filePath}`);
    const content = `
export async function generateStaticParams() {
  // Return a placeholder value for static build
  return [{ ${parts[parts.length-1].replace(/[\[\]]/g, '')}: "placeholder" }];
}
`;
    fs.writeFileSync(filePath, content);
  }
});

// Run the Next.js build
console.log('🏗️ Building the Next.js application...');

// Try to build with a few different approaches
let buildSuccess = false;

// Approach 1: Use npx next build with output export
buildSuccess = runCommand('npx next build');

if (!buildSuccess) {
  console.log('⚠️ First build approach failed, trying alternative...');
  // Approach 2: Try the static export build script
  buildSuccess = runCommand('npm run build:static');
}

// Clean up temporary files
console.log('🧹 Cleaning up temporary generateStaticParams files...');
dynamicRoutes.forEach(({ route }) => {
  const parts = route.split('/');
  const filePath = path.join('src', 'app', ...parts, 'generateStaticParams.js');
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
});

if (!buildSuccess) {
  console.error('❌ All build approaches failed. Creating fallback page...');
  
  // Restore admin routes even on failure
  console.log('🔄 Restoring admin routes after failed build...');
  tempPaths.forEach(({ original, temp }) => {
    if (fs.existsSync(temp)) {
      fs.renameSync(temp, original);
      console.log(`✅ Restored ${original} from ${temp}`);
    }
  });
  
  // Create out directory for a fallback page
  if (!fs.existsSync('out')) {
    fs.mkdirSync('out', { recursive: true });
  }
  
  // Create a minimal index.html as fallback
  const minimalHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Smart QR Code Generator</title>
  <style>
    body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
    .error { background: #f8d7da; color: #842029; padding: 1rem; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Smart QR Code Generator</h1>
  <div class="error">
    <p>There was an error during the build process.</p>
    <p>Please try again later or contact the site administrator.</p>
  </div>
</body>
</html>
  `.trim();
  
  fs.writeFileSync(path.join('out', 'index.html'), minimalHtml);
  console.log('📄 Created minimal index.html as fallback');
  
  process.exit(1);
}

console.log('✅ Build completed successfully!');

// Restore admin routes after successful build
console.log('🔄 Restoring admin routes after successful build...');
tempPaths.forEach(({ original, temp }) => {
  if (fs.existsSync(temp)) {
    fs.renameSync(temp, original);
    console.log(`✅ Restored ${original} from ${temp}`);
  }
});

// The 'out' directory should contain the exported static site
if (fs.existsSync('out')) {
  console.log('🧹 Removing excluded paths from static export...');
  
  // Remove excluded paths
  excludedPaths.forEach(excludedPath => {
    const fullPath = path.join('out', excludedPath);
    removeDirectory(fullPath);
  });
  
  // Create placeholder pages for excluded paths
  console.log('📝 Creating placeholder pages for excluded paths...');
  excludedPaths.forEach(excludedPath => {
    createPlaceholderPage(excludedPath);
  });
  
  console.log('✅ All excluded paths processed. Build complete!');
} else {
  console.error('❌ Output directory "out" not found!');
  process.exit(1);
}

// Function to create a placeholder page that redirects to home
function createPlaceholderPage(pagePath) {
  const folderPath = path.join('out', pagePath);
  
  // Create folder if it doesn't exist
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  
  // Create index.html in the folder
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Redirecting...</title>
  <script>
    window.location.href = "/";
  </script>
</head>
<body>
  <p>Redirecting to home page...</p>
</body>
</html>
  `.trim();
  
  fs.writeFileSync(path.join(folderPath, 'index.html'), html);
  console.log(`📄 Created placeholder: ${folderPath}/index.html`);
}

// Helper function to execute a command with proper error handling
function runCommand(command) {
  try {
    console.log(`Running command: ${command}`);
    execSync(command, { 
      stdio: 'inherit',
      env: {
        ...process.env,
        NEXT_DISABLE_ESLINT: '1',
        NEXT_DISABLE_TYPE_CHECKS: '1',
        NEXT_TELEMETRY_DISABLED: '1'
      }
    });
    return true;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    console.error(error.message);
    return false;
  }
} 