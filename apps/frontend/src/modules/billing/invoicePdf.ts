import { getApiBaseUrl } from '@/lib/apiBase';

const CACHE_TTL_MS = 120_000;
const FETCH_TIMEOUT_MS = 45_000;

const blobCache = new Map<string, { blob: Blob; at: number }>();
const inflight = new Map<string, Promise<Blob>>();

function cacheKey(billId: string, format: 'a4' | 'thermal'): string {
  return `${billId}:${format}`;
}

async function parseApiError(res: Response): Promise<string> {
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try {
      const json = (await res.json()) as { message?: string | string[]; error?: string };
      const msg = json.message;
      if (Array.isArray(msg)) return msg.join(', ');
      if (typeof msg === 'string') return msg;
      if (json.error) return json.error;
    } catch {
      /* fall through */
    }
  }
  if (res.status === 401) return 'Session expired — sign in again';
  if (res.status === 403) return 'Not allowed to open this invoice';
  if (res.status === 404) return 'Invoice PDF not ready — wait a moment and retry';
  return `Could not load PDF (${res.status})`;
}

async function assertPdfBlob(blob: Blob): Promise<void> {
  const head = await blob.slice(0, 8).text();
  if (!head.startsWith('%PDF')) {
    throw new Error('Server did not return a valid PDF — refresh and try again');
  }
}

/** One network request per bill+format; reuse cache for print + download. */
export async function fetchInvoicePdfBlob(
  billId: string,
  accessToken: string,
  format: 'a4' | 'thermal',
): Promise<Blob> {
  const key = cacheKey(billId, format);
  const hit = blobCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.blob;
  }

  const existing = inflight.get(key);
  if (existing) return existing;

  const task = (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${getApiBaseUrl()}/invoices/bill/${billId}/pdf?format=${format}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        throw new Error(await parseApiError(res));
      }

      const blob = await res.blob();
      if (blob.size < 64) {
        throw new Error('PDF file is empty — try again in a few seconds');
      }
      await assertPdfBlob(blob);
      blobCache.set(key, { blob, at: Date.now() });
      return blob;
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw new Error('PDF request timed out — try again');
      }
      throw e;
    } finally {
      window.clearTimeout(timeout);
    }
  })();

  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Open PDF in new tab (print with Ctrl+P there). Does not auto-download. */
export async function openInvoicePdfTab(
  billId: string,
  accessToken: string,
  format: 'a4' | 'thermal' = 'a4',
): Promise<void> {
  const blob = await fetchInvoicePdfBlob(billId, accessToken, format);
  const url = URL.createObjectURL(blob);
  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (!popup) {
    URL.revokeObjectURL(url);
    throw new Error('Popup blocked — allow popups or use Save PDF');
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

/** Same as open tab; optional print() when the tab allows it. */
export async function printInvoicePdf(
  billId: string,
  accessToken: string,
  format: 'a4' | 'thermal' = 'a4',
): Promise<void> {
  const blob = await fetchInvoicePdfBlob(billId, accessToken, format);
  const url = URL.createObjectURL(blob);
  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (!popup) {
    URL.revokeObjectURL(url);
    throw new Error('Popup blocked — use Save PDF or allow popups');
  }
  window.setTimeout(() => {
    try {
      popup.focus();
      popup.print();
    } catch {
      /* user can Ctrl+P */
    }
  }, 800);
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

export async function downloadInvoicePdf(
  billId: string,
  accessToken: string,
  invoiceNo: string,
  format: 'a4' | 'thermal' = 'a4',
): Promise<void> {
  const blob = await fetchInvoicePdfBlob(billId, accessToken, format);
  triggerDownload(blob, `${invoiceNo.replace(/\//g, '-')}-${format}.pdf`);
}
