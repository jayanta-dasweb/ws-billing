import type { CatalogBatchDto, CatalogProductDto } from '@billing/shared';

export type ScanResolveResult =
  | { kind: 'not_found' }
  | { kind: 'add'; productId: string; batchId: string; batchNumber: string }
  | { kind: 'pick_batch'; product: CatalogProductDto };

function sellableBatches(product: CatalogProductDto): CatalogBatchDto[] {
  return product.batches.filter((b) => b.availableQty > 0.0001);
}

/** Resolve a barcode / batch sticker scan to an add action or batch picker (no silent FIFO). */
export function resolveCatalogScan(
  code: string,
  products: CatalogProductDto[],
): ScanResolveResult {
  const normalized = code.trim();
  if (!normalized) return { kind: 'not_found' };

  let product =
    products.find((p) => p.barcode?.trim() === normalized) ??
    products.find((p) => p.sku?.trim() === normalized) ??
    null;

  let batchFromSticker: CatalogBatchDto | undefined;
  if (!product) {
    for (const p of products) {
      const batch = p.batches.find((b) => b.batchNumber === normalized);
      if (batch) {
        product = p;
        batchFromSticker = batch;
        break;
      }
    }
  }

  if (!product) return { kind: 'not_found' };

  if (batchFromSticker) {
    if (batchFromSticker.availableQty > 0.0001) {
      return {
        kind: 'add',
        productId: product.id,
        batchId: batchFromSticker.id,
        batchNumber: batchFromSticker.batchNumber,
      };
    }
    return { kind: 'not_found' };
  }

  const sellable = sellableBatches(product);
  if (sellable.length === 0) return { kind: 'not_found' };
  if (sellable.length === 1) {
    return {
      kind: 'add',
      productId: product.id,
      batchId: sellable[0].id,
      batchNumber: sellable[0].batchNumber,
    };
  }

  return { kind: 'pick_batch', product };
}
