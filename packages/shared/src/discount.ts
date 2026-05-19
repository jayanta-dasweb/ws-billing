/** Line gross before discount (qty × rate). */
export function lineGross(qty: number, rate: number): number {
  return round2(qty * rate);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface MasterDiscountSource {
  discountPercent?: number;
  discountPerUnit?: number;
}

/** Default line discount from product/batch master (batch wins when set). */
export function calcMasterLineDiscount(
  qty: number,
  rate: number,
  product: MasterDiscountSource,
  batch?: MasterDiscountSource,
): number {
  const gross = lineGross(qty, rate);
  const pct =
    (batch?.discountPercent ?? 0) > 0
      ? Number(batch!.discountPercent)
      : Number(product.discountPercent ?? 0);
  const perUnit =
    (batch?.discountPerUnit ?? 0) > 0
      ? Number(batch!.discountPerUnit)
      : Number(product.discountPerUnit ?? 0);
  const discount = round2((gross * pct) / 100 + qty * perUnit);
  return Math.min(discount, gross);
}

export function discountFromPercent(gross: number, percent: number): number {
  const discount = round2((gross * percent) / 100);
  return Math.min(discount, round2(gross));
}

export function lineDiscountPercent(qty: number, rate: number, discount: number): number {
  const gross = lineGross(qty, rate);
  if (gross <= 0) return 0;
  return round2((discount / gross) * 100);
}

/** Keep manual or master discount in proportion when qty changes. */
export function scaleLineDiscount(discount: number, oldQty: number, newQty: number): number {
  if (oldQty <= 0) return 0;
  return round2((discount * newQty) / oldQty);
}
