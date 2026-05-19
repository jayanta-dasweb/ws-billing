import { rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

if (existsSync(dist)) {
  rmSync(dist, { recursive: true, force: true });
  console.log('Removed backend dist/');
}
