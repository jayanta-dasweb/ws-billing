/**
 * API base URL for HTTP calls.
 * In the browser, prefer same-origin `/api/v1` (Next.js rewrite → Nest) so auth
 * cookies and CSRF tokens work after page refresh. Cross-port (:3000 → :4000)
 * breaks session restore because HttpOnly refresh cookies and CSRF are not
 * visible on the page origin.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (configured) {
      if (configured.startsWith('/')) return configured.replace(/\/$/, '');
      try {
        const u = new URL(configured);
        const page = window.location;
        if (u.host !== page.host) {
          return '/api/v1';
        }
      } catch {
        /* use configured as-is */
      }
      return configured.replace(/\/$/, '');
    }
    return '/api/v1';
  }

  const internal = process.env.BACKEND_INTERNAL_URL?.replace(/\/$/, '');
  if (internal) return `${internal}/api/v1`;
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:4000/api/v1'
  );
}
