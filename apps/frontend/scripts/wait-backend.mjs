/**
 * Wait until Nest health responds before starting Next dev (avoids PARSING_ERROR on proxy).
 */
const url =
  process.env.BACKEND_INTERNAL_URL?.replace(/\/$/, '') ||
  'http://127.0.0.1:4000';
const healthUrl = `${url}/api/v1/health`;
const maxAttempts = Number(process.env.BACKEND_WAIT_ATTEMPTS || 120);
const delayMs = 1000;
/** Nest first compile after `npm run dev` often takes 20–40s on Windows. */
const initialDelayMs = Number(process.env.BACKEND_WAIT_INITIAL_MS || 5000);

async function ping() {
  const res = await fetch(healthUrl, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) return false;
  const body = await res.json();
  if (body?.success === true) return true;
  return body?.status === 'healthy' || body?.data?.status === 'healthy';
}

if (initialDelayMs > 0) {
  console.log(`Giving API time to compile (${initialDelayMs / 1000}s)…`);
  await new Promise((r) => setTimeout(r, initialDelayMs));
}

for (let i = 1; i <= maxAttempts; i++) {
  try {
    if (await ping()) {
      console.log(`Backend ready at ${healthUrl}`);
      process.exit(0);
    }
  } catch {
    /* retry */
  }
  console.log(`Waiting for backend (${i}/${maxAttempts})…`);
  await new Promise((r) => setTimeout(r, delayMs));
}

console.error(`Backend did not respond at ${healthUrl} — start API first (port 4000).`);
process.exit(1);
