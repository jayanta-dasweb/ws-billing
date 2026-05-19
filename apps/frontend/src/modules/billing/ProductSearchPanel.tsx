'use client';

import { ProductSearchModal } from './ProductSearchModal';

interface ProductSearchPanelProps {
  disabled?: boolean;
  onAdd: (productId: string, batchId: string) => void;
}

/** @deprecated Billing uses ProductSearchModal (F8). Shim for hot-reload / old bundles. */
export function ProductSearchPanel({ disabled, onAdd }: ProductSearchPanelProps) {
  return <ProductSearchModal open disabled={disabled} onClose={() => {}} onAdd={onAdd} />;
}
