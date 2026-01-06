/* eslint-disable no-console */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  child.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

const projectRoot = process.cwd();
const standaloneServer = path.join(projectRoot, '.next', 'standalone', 'server.js');

const port = process.env.PORT || '3000';
// Use HOST or default to 0.0.0.0 for binding (HOSTNAME is often the container ID)
const host = process.env.HOST || '0.0.0.0';

if (fs.existsSync(standaloneServer)) {
  console.log(`Starting Next.js standalone server on ${host}:${port}...`);
  run(process.execPath, [standaloneServer], { PORT: port, HOSTNAME: host });
} else {
  // Fallback for non-standalone builds.
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  console.log(`Starting Next.js (next start) on ${host}:${port}...`);
  run(npxCmd, ['next', 'start', '-H', host, '-p', port], {});
}
