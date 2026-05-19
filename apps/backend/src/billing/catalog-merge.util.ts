/** One catalog row per SKU/name — merges batches when duplicate product masters exist. */
export type CatalogBatchRow = {
  id: string;
  batchNumber: string;
  expiryDate: string | null;
  mrp: number;
  sellingPrice: number;
  stockQty: number;
  pendingQty: number;
  availableQty: number;
};

export type CatalogProductRow = {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  hsnCode: string | null;
  gstPercent: number;
  batches: CatalogBatchRow[];
};

function catalogKey(p: { sku: string | null; barcode: string | null; name: string }): string {
  if (p.sku?.trim()) return `sku:${p.sku.trim().toLowerCase()}`;
  if (p.barcode?.trim()) return `bc:${p.barcode.trim()}`;
  return `name:${p.name.trim().toLowerCase()}`;
}

export function mergeCatalogProducts(rows: CatalogProductRow[]): CatalogProductRow[] {
  const map = new Map<string, CatalogProductRow>();

  for (const p of rows) {
    const key = catalogKey(p);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...p, batches: [...p.batches] });
      continue;
    }

    const byId = new Map<string, CatalogBatchRow>();
    for (const b of existing.batches) byId.set(b.id, b);
    for (const b of p.batches) byId.set(b.id, b);

    const mergedBatches = [...byId.values()].sort((a, b) =>
      (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999'),
    );

    const primary = p.batches.length > existing.batches.length ? p : existing;
    map.set(key, {
      ...primary,
      name: primary.name,
      barcode: primary.barcode ?? p.barcode,
      sku: primary.sku ?? p.sku,
      batches: mergedBatches,
    });
  }

  return [...map.values()]
    .filter((p) => p.batches.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}
