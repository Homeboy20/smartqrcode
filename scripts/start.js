/* eslint-disable no-console */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(command, args, extraEnv = {}, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
    ...options,
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  child.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return;
  
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((child) => {
      copyRecursiveSync(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

const projectRoot = process.cwd();
const standaloneServer = path.join(projectRoot, '.next', 'standalone', 'server.js');
const standaloneDir = path.join(projectRoot, '.next', 'standalone');

const port = process.env.PORT || '3000';
// Use HOST or default to 0.0.0.0 for binding (HOSTNAME is often the container ID)
const host = process.env.HOST || '0.0.0.0';

if (fs.existsSync(standaloneServer)) {
  console.log('Preparing standalone server...');
  
  // Copy static assets to standalone directory
  const staticSrc = path.join(projectRoot, '.next', 'static');
  const staticDest = path.join(projectRoot, '.next', 'standalone', '.next', 'static');
  
  if (fs.existsSync(staticSrc)) {
    console.log('Copying static assets...');
    copyRecursiveSync(staticSrc, staticDest);
  }
  
  // Copy public folder to standalone directory
  const publicSrc = path.join(projectRoot, 'public');
  const publicDest = path.join(projectRoot, '.next', 'standalone', 'public');
  
  if (fs.existsSync(publicSrc)) {
    console.log('Copying public files...');
    copyRecursiveSync(publicSrc, publicDest);
  }
  
  console.log(`Starting Next.js standalone server on ${host}:${port}...`);
  run(process.execPath, [standaloneServer], { PORT: port, HOSTNAME: host }, { cwd: standaloneDir });
} else {
  // Fallback for non-standalone builds.
  console.log(`Starting Next.js (next start) on ${host}:${port}...`);
  const nextCli = require.resolve('next/dist/bin/next');
  run(process.execPath, [nextCli, 'start', '-H', host, '-p', port], {}, { cwd: projectRoot });
}
