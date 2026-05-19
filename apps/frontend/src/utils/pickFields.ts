/** Pick only whitelisted keys for API write bodies (avoids id/createdAt validation errors). */
export function pickFields<T extends Record<string, unknown>>(
  source: Record<string, unknown>,
  keys: readonly (keyof T)[],
): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const k = key as string;
    if (k in source && source[k] !== undefined) {
      out[k] = source[k];
    }
  }
  return out as Partial<T>;
}

export const MASTER_WRITE_FIELDS = {
  company: [
    'name',
    'address',
    'gstin',
    'pan',
    'phone',
    'email',
    'logoUrl',
    'invoiceFooter',
    'invoiceTerms',
    'isActive',
  ],
  paymentMode: ['code', 'name', 'sortOrder', 'isActive'],
  customer: [
    'name',
    'mobile',
    'gstNumber',
    'panNumber',
    'billingAddress',
    'shippingAddress',
    'email',
    'creditLimit',
    'customerType',
    'isActive',
  ],
  product: [
    'name',
    'barcode',
    'sku',
    'hsnCode',
    'taxMasterId',
    'sellingPrice',
    'discountPercent',
    'discountPerUnit',
    'batchEnabled',
    'isActive',
  ],
} as const;
