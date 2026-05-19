/**
 * Recover from P3009 (failed migration) after pulling the migration-order fix.
 * Loads repo-root .env and runs: migrate resolve --rolled-back → migrate deploy
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(backendDir, '../..');
const envPath = resolve(repoRoot, '.env');

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

function runPrisma(args) {
  const result = spawnSync('npx', ['prisma', ...args], {
    cwd: backendDir,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const FAILED_MIGRATION = '20260517220000_cashier_customer_perms';

loadEnvFile(envPath);

console.log('Marking failed migration as rolled back:', FAILED_MIGRATION);
runPrisma(['migrate', 'resolve', '--rolled-back', FAILED_MIGRATION]);

console.log('Applying pending migrations…');
runPrisma(['migrate', 'deploy']);

console.log('\nRecovery complete. Run from repo root: npm run prisma:seed');
