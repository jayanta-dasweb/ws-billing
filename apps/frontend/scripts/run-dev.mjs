/**
 * Start Next dev with NEXT_DIST_DIR=.next-dev (keeps production `.next` separate).
 */
import { spawn } from 'node:child_process';

const env = { ...process.env, NEXT_DIST_DIR: '.next-dev' };

const child = spawn('npx next dev -p 3000', {
  stdio: 'inherit',
  env,
  shell: true,
  cwd: process.cwd(),
});

child.on('exit', (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
