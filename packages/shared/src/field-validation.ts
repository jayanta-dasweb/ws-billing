/** Indian mobile: 10 digits, first digit 6–9. Accepts +91 / 91 prefix when normalizing. */
const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;

/** GSTIN: 15-char GST format (state + PAN + entity + Z + checksum). */
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function digitsOnly(value: string, maxLen?: number): string {
  let d = value.replace(/\D/g, '');
  if (maxLen != null) d = d.slice(0, maxLen);
  return d;
}

/** Returns normalized 10-digit mobile or null if invalid. */
export function normalizeIndianMobile(input: string): string | null {
  const d = digitsOnly(input);
  if (d.length === 10 && INDIAN_MOBILE_RE.test(d)) return d;
  if (d.length === 12 && d.startsWith('91') && INDIAN_MOBILE_RE.test(d.slice(2))) return d.slice(2);
  return null;
}

export function validateIndianMobile(
  input: string,
  options?: { required?: boolean },
): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return options?.required ? 'Mobile number is required' : null;
  }
  if (!normalizeIndianMobile(trimmed)) {
    return 'Enter a valid 10-digit mobile (starts with 6–9)';
  }
  return null;
}

export function formatGstinInput(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15);
}

export function validateOptionalGstin(input: string): string | null {
  const t = formatGstinInput(input);
  if (!t) return null;
  if (t.length !== 15 || !GSTIN_RE.test(t)) {
    return 'GSTIN must be 15 characters (e.g. 27AABCU9603R1ZM)';
  }
  return null;
}

export function formatPanInput(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 10);
}

export function validateOptionalPan(input: string): string | null {
  const t = formatPanInput(input);
  if (!t) return null;
  if (!PAN_RE.test(t)) return 'PAN must be 10 characters (e.g. ABCDE1234F)';
  return null;
}

export function validateOptionalEmail(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  if (!EMAIL_RE.test(t)) return 'Enter a valid email address';
  return null;
}

export function validateCustomerFields(fields: {
  name: string;
  mobile: string;
  email?: string;
  gstNumber?: string;
  panNumber?: string;
}): string | null {
  if (!fields.name.trim()) return 'Name is required';
  const mobileErr = validateIndianMobile(fields.mobile, { required: true });
  if (mobileErr) return mobileErr;
  const emailErr = validateOptionalEmail(fields.email ?? '');
  if (emailErr) return emailErr;
  const gstErr = validateOptionalGstin(fields.gstNumber ?? '');
  if (gstErr) return gstErr;
  const panErr = validateOptionalPan(fields.panNumber ?? '');
  if (panErr) return panErr;
  return null;
}
