'use client';

import { useEffect } from 'react';
import { useBillingStore } from '@/stores/billingStore';

export interface ShortcutHandlers {
  /** Focus barcode / scan field */
  onFocusScan?: () => void;
  /** Open product finder (F8) */
  onProductSearch?: () => void;
  onSelectCustomer?: () => void;
  onPayment?: () => void;
  onHoldBill?: () => void;
  onCompleteBill?: () => void;
  onEditQty?: () => void;
  onPrint?: () => void;
  /** Remove selected line, or last line if none selected */
  onDeleteLine?: () => void;
  /** Clear line selection and return focus to barcode */
  onDeselectLine?: () => void;
  onLineUp?: () => void;
  onLineDown?: () => void;
  /** 1–9 = line 1–9, 10 = line 10 */
  onSelectLineNumber?: (lineNumber: number) => void;
}

const POS_KEYS = new Set(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8']);
const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'Delete', 'Home', 'End']);

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const setFocusField = useBillingStore((s) => s.setFocusField);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Let billing modals (customer, product, payment) handle their own keys
      if (document.querySelector('[aria-modal="true"]')) {
        return;
      }

      const inField =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      const inLineEdit =
        inField && (e.target as HTMLElement).closest?.('.billing-line-edit') != null;

      if (inField && !POS_KEYS.has(e.key) && e.key !== 'Escape' && !NAV_KEYS.has(e.key)) {
        if (/^[0-9]$/.test(e.key)) return;
        return;
      }

      // Tab moves between qty → disc → Done inside line editor (no global shortcut)
      if (inLineEdit && e.key === 'Tab') return;

      if (e.key === 'Escape') {
        e.preventDefault();
        handlers.onDeselectLine?.();
        return;
      }

      if (e.key === 'Delete') {
        e.preventDefault();
        handlers.onDeleteLine?.();
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlers.onLineUp?.();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        handlers.onLineDown?.();
        return;
      }

      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        handlers.onSelectLineNumber?.(Number(e.key));
        return;
      }

      if (e.key === '0') {
        e.preventDefault();
        handlers.onSelectLineNumber?.(10);
        return;
      }

      switch (e.key) {
        case 'F1':
          e.preventDefault();
          handlers.onFocusScan?.();
          break;
        case 'F8':
          e.preventDefault();
          setFocusField('product-search');
          handlers.onProductSearch?.();
          break;
        case 'F2':
          e.preventDefault();
          setFocusField('customer');
          handlers.onSelectCustomer?.();
          break;
        case 'F3':
          e.preventDefault();
          handlers.onPayment?.();
          break;
        case 'F4':
          e.preventDefault();
          handlers.onHoldBill?.();
          break;
        case 'F5':
          e.preventDefault();
          handlers.onCompleteBill?.();
          break;
        case 'F6':
          e.preventDefault();
          handlers.onEditQty?.();
          break;
        case 'F7':
          e.preventDefault();
          handlers.onPrint?.();
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers, setFocusField]);
}
