'use client';

import { ProductSearchModal } from './ProductSearchModal';

interface ProductSearchPanelProps {
  disabled?: boolean;
  onAdd: (productId: string, batchId: string) => void;
}

/** @deprecated Billing uses ProductSearchModal (F8). */
export function ProductSearchPanel({ disabled, onAdd }: ProductSearchPanelProps) {
  return <ProductSearchModal open disabled={disabled} onClose={() => {}} onAdd={onAdd} />;
}

/** Runtime alias for old dev bundles — must be a value export, not `import type` + `void`. */
export const ProductSearchPanelShim = ProductSearchPanel;
