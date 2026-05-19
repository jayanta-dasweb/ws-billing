/**
 * @billing/shared ships compiled JS in packages/shared/dist (not committed).
 * Run before backend dev if someone started nest from apps/backend only.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const sharedEntry = resolve(repoRoot, 'packages/shared/dist/index.js');

if (!existsSync(sharedEntry)) {
  console.log('@billing/shared not built — running npm run build -w @billing/shared …');
  const result = spawnSync('npm', ['run', 'build', '-w', '@billing/shared'], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
