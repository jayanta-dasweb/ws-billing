function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getCsrfToken(): string | null {
  return readCookie('csrf_token');
}

export function getCustomerCsrfToken(): string | null {
  return readCookie('customer_csrf_token');
}

export function hasCookie(name: string): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((c) => c.trim().startsWith(`${name}=`));
}

/** Staff session hint — `refresh_token` is HttpOnly and not readable here. */
export function hasStaffSessionCookie(): boolean {
  return hasCookie('csrf_token');
}

/** Customer portal session hint — refresh cookie is HttpOnly. */
export function hasCustomerSessionCookie(): boolean {
  return hasCookie('customer_csrf_token');
}
