/**
 * Apply migrations; if P3009 (failed migration), mark rolled back and deploy again.
 * For a completely empty DB, only `migrate deploy` runs (no resolve step).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(backendDir, '../..');
const envPath = resolve(repoRoot, '.env');
const FAILED_MIGRATION = '20260517220000_cashier_customer_perms';

function loadEnvFile(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    console.error(`Missing ${path} — copy .env.example to .env at repo root first.`);
    process.exit(1);
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function runPrisma(args, { allowFail = false } = {}) {
  const result = spawnSync('npx', ['prisma', ...args], {
    cwd: backendDir,
    stdio: 'pipe',
    shell: true,
    env: process.env,
    encoding: 'utf8',
  });
  const out = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (out) process.stdout.write(out);
  if (!allowFail && result.status !== 0) {
    return { ok: false, output: out, status: result.status ?? 1 };
  }
  return { ok: result.status === 0, output: out, status: result.status ?? 0 };
}

loadEnvFile(envPath);

console.log('Applying database migrations (prisma migrate deploy)…');
let deploy = runPrisma(['migrate', 'deploy'], { allowFail: true });

if (deploy.ok) {
  console.log('\nMigrations applied. Run from repo root: npm run prisma:seed');
  process.exit(0);
}

const isP3009 =
  deploy.output.includes('P3009') ||
  deploy.output.includes('failed migrations') ||
  deploy.output.includes(FAILED_MIGRATION);

if (!isP3009) {
  console.error('\nMigrate deploy failed. Fix the error above (MySQL running? .env DATABASE_URL correct?).');
  process.exit(deploy.status || 1);
}

console.log('\nDetected failed migration (P3009). Marking as rolled back:', FAILED_MIGRATION);
const resolve = runPrisma(['migrate', 'resolve', '--rolled-back', FAILED_MIGRATION]);
if (!resolve.ok) {
  console.error(
    '\nCould not resolve failed migration. For a fresh empty database use:\n' +
      '  npm run prisma:deploy\n' +
      '  npm run prisma:seed\n' +
      'From repo root — not prisma:recover.',
  );
  process.exit(resolve.status || 1);
}

console.log('Re-applying migrations…');
deploy = runPrisma(['migrate', 'deploy']);
if (!deploy.ok) process.exit(deploy.status || 1);

console.log('\nRecovery complete. Run from repo root: npm run prisma:seed');
