/**
 * Remove Next.js build cache. Run only when dev is STOPPED (Ctrl+C), then `npm run dev`.
 * Deleting `.next` while `next dev` is running causes routes-manifest / 500 errors on Windows.
 */
import { rmSync, existsSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const targets = ['.next', '.next-dev', join('node_modules', '.cache')];

for (const dir of targets) {
  const path = join(root, dir);
  if (existsSync(path)) {
    try {
      rmSync(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      console.log(`Removed ${dir}`);
    } catch (err) {
      console.error(`Failed to remove ${dir}. Stop "npm run dev" first, then retry.`);
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  }
}

console.log('Cache cleared. Start the app with: npm run dev');
