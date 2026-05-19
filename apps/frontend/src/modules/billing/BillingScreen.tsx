'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  BillRoundOffMode,
  CatalogProductDto,
  CompleteBillDto,
  InvoiceDetailDto,
} from '@billing/shared';
import { BillStatus, UserRole } from '@billing/shared';
import { useBillingStore } from '@/stores/billingStore';
import { billingApi } from '@/services/api/billingApi';
import { store } from '@/redux/store';
import { useBillingSocket } from '@/websocket/useBillingSocket';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@/redux/store';
import { setStockAlert } from '@/redux/slices/websocketSlice';
import {
  useCancelBillMutation,
  useCleanupEmptyDraftsMutation,
  useCompleteBillMutation,
  useCreateBillMutation,
  useHoldBillMutation,
  useListOpenBillsQuery,
  useRemoveLineMutation,
  useResumeBillMutation,
  useAddProductLineMutation,
  useLazySearchCatalogQuery,
  useScanBarcodeMutation,
  useSetBillCustomerMutation,
  useSetBillDiscountMutation,
  useSetBillRoundOffMutation,
  useUpdateLineMutation,
  usePublishShortageAlertMutation,
  useListOnlineCountersQuery,
  useTransferBillMutation,
} from '@/services/api/billingApi';
import {
  getApiErrorMessage,
  isBillClosedError,
  isInsufficientStockError,
  parseInsufficientStockAvailable,
} from '@/utils/api';
import { canEditBill, isOpenBillStatus } from '@/utils/canEditBill';
import { calcShortageForAttemptedQty, displayLineQty } from '@/utils/lineStock';
import { resolveCatalogScan } from '@/utils/resolveCatalogScan';
import { getEffectiveRole } from '@/utils/roles';
import { BillTransferModal } from './BillTransferModal';
import { DiscountField } from '@/components/billing/DiscountField';
import { NumericInput } from '@/components/masters/NumericInput';
import { lineGross, round2, totalsFromLineItems } from '@billing/shared';
import { BillTabs } from './BillTabs';
import { BillingBusyOverlay } from './BillingBusyOverlay';
import { CustomerSearchModal } from './CustomerSearchModal';
import { WALK_IN_CUSTOMER_ID } from './CustomerPanel';
import { ProductSearchModal } from './ProductSearchModal';
import { PaymentModal, type PaymentTotals } from './PaymentModal';
import { BillReprintModal } from './BillReprintModal';
import { InvoicePrintModal } from './InvoicePrintModal';
import { OfflineBanner } from '@/components/billing/OfflineBanner';
import {
  LineStockIndicators,
  lineItemHasShortage,
} from '@/components/billing/LineStockIndicators';
import { WsConnectionStrip } from '@/components/billing/WsConnectionStrip';
import { BillingAlertsStrip } from '@/components/billing/OperationalGuidanceBar';
import { BillingKeyboardHelp } from '@/components/billing/BillingKeyboardHelp';
import { useBillReservationHeartbeat } from '@/hooks/useBillReservationHeartbeat';
import {
  clearBatchShortageAlert,
  clearShortageAlertsForBill,
  setBatchStocks,
} from '@/redux/slices/stockSlice';
import { useOfflineBillingSync } from '@/hooks/useOfflineBillingSync';
import { useTimedAlerts } from '@/hooks/useTimedAlerts';
import { useLazyGetInvoiceByBillQuery } from '@/services/api/invoiceApi';
import { enqueueOfflineAction } from '@/lib/offline/offlineQueue';
import { loadBillingDraft } from '@/lib/offline/billingDraft';

const EDITABLE: BillStatus[] = [BillStatus.DRAFT, BillStatus.HOLD]; // used for park/switch guards

async function fetchBill(id: string) {
  const result = await store.dispatch(
    billingApi.endpoints.getBill.initiate(id, { forceRefetch: true }),
  );
  if ('data' in result && result.data) return result.data;
  throw new Error('Could not load bill');
}

export function BillingScreen() {
  const dispatch = useDispatch();
  const barcodeRef = useRef<HTMLInputElement>(null);
  const lineQtyRef = useRef<HTMLInputElement>(null);
  const lineDiscRef = useRef<HTMLInputElement>(null);
  const lineDoneRef = useRef<HTMLButtonElement>(null);
  const lineQtyApplyRef = useRef(0);
  const billId = useBillingStore((s) => s.billId);
  const items = useBillingStore((s) => s.items);
  const customerId = useBillingStore((s) => s.customerId);
  const customerName = useBillingStore((s) => s.customerName);
  const customerMobile = useBillingStore((s) => s.customerMobile);
  const customerGst = useBillingStore((s) => s.customerGst);
  const customerEmail = useBillingStore((s) => s.customerEmail);
  const customerPan = useBillingStore((s) => s.customerPan);
  const customerAddress = useBillingStore((s) => s.customerAddress);
  const grandTotal = useBillingStore((s) => s.grandTotal);
  const subtotal = useBillingStore((s) => s.subtotal);
  const lineDiscountTotal = useBillingStore((s) => s.lineDiscountTotal);
  const billDiscount = useBillingStore((s) => s.billDiscount);
  const cgstTotal = useBillingStore((s) => s.cgstTotal);
  const sgstTotal = useBillingStore((s) => s.sgstTotal);
  const igstTotal = useBillingStore((s) => s.igstTotal);
  const rawGrandTotal = useBillingStore((s) => s.rawGrandTotal);
  const roundOff = useBillingStore((s) => s.roundOff);
  const status = useBillingStore((s) => s.status);
  const invoiceNo = useBillingStore((s) => s.invoiceNo);
  const syncFromBill = useBillingStore((s) => s.syncFromBill);
  const patchLineLocally = useBillingStore((s) => s.patchLineLocally);
  const clearBill = useBillingStore((s) => s.clearBill);
  const setCustomer = useBillingStore((s) => s.setCustomer);
  const user = useSelector((s: RootState) => s.auth.user);
  const accessToken = useSelector((s: RootState) => s.auth.accessToken);
  const stockAlert = useSelector((s: RootState) => s.websocket.stockAlert);
  const batchShortageAlerts = useSelector((s: RootState) => s.stock.batchShortageAlerts);
  const wsConnected = useSelector((s: RootState) => s.websocket.connected);
  const counterId = user?.counterId;
  const isCashier = user ? getEffectiveRole(user) === UserRole.CASHIER : false;

  const [fetchInvoice] = useLazyGetInvoiceByBillQuery();

  const { message, error, setMessage, setError } = useTimedAlerts();
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [stockHintLineId, setStockHintLineId] = useState<string | null>(null);
  const [lineShortageHints, setLineShortageHints] = useState<
    Record<string, { short: number; attemptedQty: number }>
  >({});
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [reprintOpen, setReprintOpen] = useState(false);
  const [invoiceDetail, setInvoiceDetail] = useState<InvoiceDetailDto | null>(null);
  const lastCompletedBillId = useRef<string | null>(null);
  const bootstrapRef = useRef<'idle' | 'loading' | 'done'>('idle');
  const stockSnapshotKeyRef = useRef('');
  const [draftReady, setDraftReady] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [batchPickProduct, setBatchPickProduct] = useState<CatalogProductDto | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);

  const [createBill, { isLoading: creating }] = useCreateBillMutation();
  const [scanBarcode, { isLoading: scanning }] = useScanBarcodeMutation();
  const [searchCatalog] = useLazySearchCatalogQuery();
  const [addProductLine, { isLoading: addingProduct }] = useAddProductLineMutation();
  const [removeLine, { isLoading: removing }] = useRemoveLineMutation();
  const [holdBill, { isLoading: holding }] = useHoldBillMutation();
  const [resumeBill, { isLoading: resuming }] = useResumeBillMutation();
  const [completeBill, { isLoading: completing }] = useCompleteBillMutation();
  const [updateLine, { isLoading: updatingLine }] = useUpdateLineMutation();
  const [publishShortageAlert] = usePublishShortageAlertMutation();
  const [setBillCustomer, { isLoading: settingCustomer }] = useSetBillCustomerMutation();
  const [setBillDiscount, { isLoading: settingDiscount }] = useSetBillDiscountMutation();
  const [setBillRoundOff, { isLoading: settingRoundOff }] = useSetBillRoundOffMutation();
  const [cancelBill] = useCancelBillMutation();
  const [cleanupEmptyDrafts] = useCleanupEmptyDraftsMutation();
  const [transferBill, { isLoading: transferring }] = useTransferBillMutation();
  const [transferBillId, setTransferBillId] = useState<string | null>(null);
  const { data: onlineCounters = [], isLoading: loadingCounters } = useListOnlineCountersQuery(
    counterId,
    { skip: !transferBillId || !counterId },
  );

  const runBusy = useCallback(async <T,>(fn: () => Promise<T>, message: string): Promise<T> => {
    setBusyMessage(message);
    try {
      return await fn();
    } finally {
      setBusyMessage(null);
    }
  }, []);

  const isBusy =
    busyMessage !== null ||
    creating ||
    scanning ||
    addingProduct ||
    completing ||
    holding ||
    resuming ||
    removing ||
    settingCustomer ||
    settingDiscount ||
    settingRoundOff ||
    transferring;

  const busyLabel =
    busyMessage ??
    (scanning
      ? 'Adding item…'
      : completing
        ? 'Completing bill…'
        : creating
          ? 'Starting bill…'
          : holding
            ? 'Parking bill…'
            : resuming
              ? 'Opening bill…'
              : removing
                ? 'Removing line…'
                : settingCustomer
                  ? 'Updating customer…'
                  : settingDiscount
                    ? 'Applying discount…'
                    : settingRoundOff
                      ? 'Updating total…'
                      : 'Please wait…');

  const { data: tabs = [], refetch: refetchTabs } = useListOpenBillsQuery(counterId, {
    skip: !counterId,
  });

  const onOfflineSynced = useCallback(
    async (result: { ok: number }) => {
      if (result.ok > 0 && billId) {
        try {
          const fresh = await fetchBill(billId);
          syncFromBill(fresh);
          void refetchTabs();
        } catch {
          /* ignore */
        }
      }
    },
    [billId, syncFromBill, refetchTabs],
  );

  const { online, pendingCount, syncing, flushQueue } = useOfflineBillingSync(
    counterId,
    onOfflineSynced,
  );

  const refetchTabsRef = useRef(refetchTabs);
  refetchTabsRef.current = refetchTabs;

  useBillingSocket(counterId ?? undefined, () => {
    void refetchTabsRef.current();
  });
  useBillReservationHeartbeat(billId, status);

  useEffect(() => {
    if (!stockAlert) return;
    if (stockAlert.kind === 'commit_failed') {
      if (stockAlert.billId === billId) {
        setError(`Stock commit failed: ${stockAlert.message}`);
      }
    } else if (stockAlert.kind === 'shortage') {
      if (stockAlert.foreignShortage) {
        setMessage(stockAlert.message);
      } else if (stockAlert.billId === billId) {
        setMessage(stockAlert.message);
      }
    }
    dispatch(setStockAlert(null));
  }, [stockAlert, billId, dispatch, setMessage, setError]);

  const isEditable = canEditBill(billId, status);
  const selectedLine = isEditable ? items.find((i) => i.id === selectedLineId) : undefined;
  const hasRealCustomer = Boolean(customerId && customerId !== WALK_IN_CUSTOMER_ID);
  const billHasShortage = useMemo(
    () =>
      items.some((item) =>
        lineItemHasShortage(
          item,
          lineShortageHints,
          item.batchId ? batchShortageAlerts[item.batchId] : undefined,
          { billId, lineId: item.id },
        ),
      ),
    [items, lineShortageHints, batchShortageAlerts],
  );

  useEffect(() => {
    if (isEditable) return;
    setSelectedLineId(null);
    setBatchPickProduct(null);
    setProductModalOpen(false);
    setPayOpen(false);
  }, [isEditable, billId, status]);

  const lineFallback = useMemo(
    () => totalsFromLineItems(items, billDiscount, roundOff),
    [items, billDiscount, roundOff],
  );

  const totalsStale = items.length > 0 && grandTotal < 0.005 && lineFallback.rawGrandTotal > 0.005;

  useEffect(() => {
    if (!draftReady || !billId || !totalsStale) return;
    void fetchBill(billId)
      .then((bill) => {
        if (isOpenBillStatus(bill.status)) syncFromBill(bill);
        else clearBill();
      })
      .catch(() => undefined);
  }, [draftReady, billId, totalsStale, syncFromBill, clearBill]);

  const effectiveGrandTotal = totalsStale ? lineFallback.grandTotal : grandTotal;
  const effectiveRawGrand = totalsStale
    ? lineFallback.rawGrandTotal
    : rawGrandTotal > 0.005
      ? rawGrandTotal
      : grandTotal;
  const effectiveExactDue = totalsStale
    ? lineFallback.exactDue
    : Math.round((effectiveRawGrand - billDiscount) * 100) / 100;

  const roundedDue = useMemo(() => Math.round(effectiveExactDue), [effectiveExactDue]);

  const paymentTotals: PaymentTotals = useMemo(
    () => ({
      subtotal: totalsStale && subtotal < 0.005 ? effectiveRawGrand : subtotal,
      lineDiscountTotal: totalsStale ? lineFallback.lineDiscountTotal : lineDiscountTotal,
      billDiscount,
      cgstTotal,
      sgstTotal,
      igstTotal,
      rawGrandTotal: effectiveRawGrand,
      roundOff,
      grandTotal: effectiveGrandTotal,
      exactDue: effectiveExactDue,
    }),
    [
      subtotal,
      lineDiscountTotal,
      billDiscount,
      cgstTotal,
      sgstTotal,
      igstTotal,
      effectiveRawGrand,
      roundOff,
      effectiveGrandTotal,
      effectiveExactDue,
      totalsStale,
      lineFallback.lineDiscountTotal,
    ],
  );

  const ensureBillId = useCallback(() => {
    const id = useBillingStore.getState().billId;
    if (!id) throw new Error('Bill not ready');
    return id;
  }, []);

  const handleApplyRoundOff = useCallback(
    async (mode: BillRoundOffMode) => {
      const id = ensureBillId();
      const bill = await setBillRoundOff({ billId: id, body: { mode } }).unwrap();
      syncFromBill(bill);
    },
    [ensureBillId, setBillRoundOff, syncFromBill],
  );

  const emptyDraftCount = useMemo(
    () => tabs.filter((t) => t.status === BillStatus.DRAFT && t.itemCount === 0).length,
    [tabs],
  );

  const startNewBill = useCallback(async () => {
    const bill = await createBill(isCashier ? undefined : { counterId }).unwrap();
    syncFromBill(bill);
    setSelectedLineId(null);
    void refetchTabs();
    barcodeRef.current?.focus();
    return bill;
  }, [createBill, isCashier, counterId, syncFromBill, refetchTabs]);

  const openPrintForBill = useCallback(
    async (targetBillId: string) => {
      setError('');
      try {
        const detail = await fetchInvoice(targetBillId).unwrap();
        setInvoiceDetail(detail);
        setPrintOpen(true);
      } catch (e) {
        setError(getApiErrorMessage(e, 'Invoice not ready — try again in a few seconds'));
      }
    },
    [fetchInvoice],
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/sw-billing.js').catch(() => undefined);
  }, []);

  useEffect(() => {
    bootstrapRef.current = 'idle';
    stockSnapshotKeyRef.current = '';
  }, [counterId]);

  useEffect(() => {
    if (!counterId) {
      setDraftReady(false);
      return;
    }
    void (async () => {
      if (billId) {
        try {
          const fresh = await fetchBill(billId);
          syncFromBill(fresh);
          if (!isOpenBillStatus(fresh.status)) {
            setMessage('Bill was closed — use + New to start');
          }
        } catch {
          clearBill();
        }
        setDraftReady(true);
        return;
      }
      const draft = await loadBillingDraft(counterId);
      if (draft?.bill) {
        try {
          const fresh = await fetchBill(draft.bill.id);
          syncFromBill(fresh);
          if (isOpenBillStatus(fresh.status)) {
            setMessage('Draft restored');
          } else {
            setMessage('Previous bill is no longer open');
          }
        } catch {
          if (!navigator.onLine && isOpenBillStatus(draft.bill.status)) {
            syncFromBill(draft.bill);
            setMessage('Restored offline draft — will sync when online');
          } else {
            clearBill();
          }
        }
      }
      setDraftReady(true);
    })();
  }, [counterId, billId, syncFromBill, clearBill, setMessage]);

  useEffect(() => {
    if (!draftReady || !billId || isOpenBillStatus(status)) return;
    clearBill();
    setSelectedLineId(null);
    void refetchTabs();
    if (tabs.length === 0) {
      void startNewBill();
    }
  }, [draftReady, billId, status, tabs.length, clearBill, refetchTabs, startNewBill]);

  const dismissIfBillClosed = useCallback(
    (e: unknown): boolean => {
      const msg = getApiErrorMessage(e, '');
      if (!isBillClosedError(msg)) return false;
      clearBill();
      setSelectedLineId(null);
      void refetchTabs();
      setError('This bill was closed. Use + New for a fresh bill.');
      return true;
    },
    [clearBill, refetchTabs, setError],
  );

  /** Bootstrap once: open latest today tab, or create one bill — never stack parallel creates. */
  useEffect(() => {
    if (!counterId || !draftReady || billId) {
      if (billId) bootstrapRef.current = 'done';
      return;
    }
    if (bootstrapRef.current !== 'idle') return;
    bootstrapRef.current = 'loading';

    void (async () => {
      try {
        await runBusy(async () => {
          const result = await store.dispatch(
            billingApi.endpoints.listOpenBills.initiate(counterId, { forceRefetch: true }),
          );
          const list = 'data' in result && result.data ? result.data : [];
          if (list.length > 0) {
            const pick = list.find((t) => t.status === BillStatus.DRAFT) ?? list[0];
            const bill =
              pick.status === BillStatus.HOLD
                ? await resumeBill(pick.id).unwrap()
                : await fetchBill(pick.id);
            syncFromBill(bill);
            if (!isOpenBillStatus(bill.status)) {
              const created = await createBill(isCashier ? undefined : { counterId }).unwrap();
              syncFromBill(created);
            }
          } else {
            const bill = await createBill(isCashier ? undefined : { counterId }).unwrap();
            syncFromBill(bill);
          }
          setSelectedLineId(null);
          void refetchTabs();
          barcodeRef.current?.focus();
        }, 'Starting bill…');
        bootstrapRef.current = 'done';
      } catch (e) {
        bootstrapRef.current = 'idle';
        setError(getApiErrorMessage(e, 'Could not start bill'));
      }
    })();
  }, [counterId, draftReady, billId, runBusy, syncFromBill, refetchTabs, createBill, isCashier, resumeBill]);

  useEffect(() => {
    const snapshots = items
      .filter((i) => i.batchId)
      .map((i) => {
        const pending = i.pendingQty ?? 0;
        const stock =
          i.stockQty ?? (i.availableQty != null ? i.availableQty - i.qty + pending : pending);
        return {
          batchId: i.batchId!,
          productId: i.productId,
          stockQty: stock,
          pendingQty: pending,
          availableQty: stock - pending,
        };
      });
    const key = snapshots
      .map((s) => `${s.batchId}:${s.availableQty}:${s.pendingQty}`)
      .join('|');
    if (!key || key === stockSnapshotKeyRef.current) return;
    stockSnapshotKeyRef.current = key;
    dispatch(setBatchStocks(snapshots));
  }, [items, dispatch]);

  const parkCurrentIfNeeded = useCallback(async () => {
    const state = useBillingStore.getState();
    if (!state.billId || state.items.length === 0) return;
    if (state.status === BillStatus.HOLD) return;
    if (state.status && !EDITABLE.includes(state.status as BillStatus)) return;
    await holdBill(state.billId).unwrap();
  }, [holdBill]);

  const switchToBill = useCallback(
    async (targetId: string) => {
      if (targetId === billId) return;
      setError('');
      const tab = tabs.find((t) => t.id === targetId);

      try {
        await runBusy(async () => {
          if (billId && billId !== targetId && isEditable && items.length > 0) {
            await parkCurrentIfNeeded();
          }

          const bill =
            tab?.status === BillStatus.HOLD
              ? await resumeBill(targetId).unwrap()
              : await fetchBill(targetId);

          syncFromBill(bill);
          if (!isOpenBillStatus(bill.status)) {
            throw new Error('Bill is no longer open');
          }
          setSelectedLineId(null);
          void refetchTabs();
          barcodeRef.current?.focus();
        }, 'Opening bill…');
      } catch (e) {
        setError(getApiErrorMessage(e, 'Could not open bill'));
      }
    },
    [
      billId,
      tabs,
      isEditable,
      items.length,
      parkCurrentIfNeeded,
      resumeBill,
      syncFromBill,
      refetchTabs,
      runBusy,
    ],
  );

  useEffect(() => {
    if (!draftReady || !billId) return;
    if (tabs.some((t) => t.id === billId)) return;
    clearBill();
    setSelectedLineId(null);
    const next = tabs[0];
    if (next) void switchToBill(next.id);
  }, [draftReady, billId, tabs, clearBill, switchToBill]);

  const handleCloseTab = useCallback(
    async (tabId: string) => {
      setError('');
      try {
        await runBusy(async () => {
          await cancelBill(tabId).unwrap();
          if (tabId === billId) {
            clearBill();
            const remaining = tabs.filter((t) => t.id !== tabId);
            if (remaining.length > 0) {
              const next = remaining[0];
              const bill =
                next.status === BillStatus.HOLD
                  ? await resumeBill(next.id).unwrap()
                  : await fetchBill(next.id);
              syncFromBill(bill);
            } else {
              await startNewBill();
            }
          }
          void refetchTabs();
        }, 'Closing bill…');
      } catch (e) {
        setError(getApiErrorMessage(e, 'Could not close bill'));
      }
    },
    [cancelBill, billId, tabs, clearBill, resumeBill, syncFromBill, startNewBill, refetchTabs, runBusy],
  );

  const handleCleanupEmpty = useCallback(async () => {
    setError('');
    try {
      await runBusy(async () => {
        const result = await cleanupEmptyDrafts({
          counterId: isCashier ? undefined : counterId,
          keepBillId: billId ?? undefined,
        }).unwrap();
        await refetchTabs();
        if (result.cancelled === 0) {
          setMessage('No empty bills to clear');
        } else {
          setMessage(`Cleared ${result.cancelled} empty bill${result.cancelled === 1 ? '' : 's'}`);
        }
      }, 'Clearing empty bills…');
    } catch (e) {
      setError(getApiErrorMessage(e, 'Cleanup failed'));
    }
  }, [cleanupEmptyDrafts, isCashier, counterId, billId, refetchTabs, runBusy]);

  const handleOpenTransfer = useCallback((tabId: string) => {
    setTransferBillId(tabId);
  }, []);

  const handleConfirmTransfer = useCallback(
    async (targetCounterId: string) => {
      if (!transferBillId) return;
      setError('');
      try {
        await runBusy(async () => {
          const result = await transferBill({
            billId: transferBillId,
            body: { targetCounterId },
          }).unwrap();
          setTransferBillId(null);
          if (transferBillId === billId) {
            clearBill();
            const remaining = tabs.filter((t) => t.id !== transferBillId);
            if (remaining.length > 0) {
              const next = remaining[0];
              const bill =
                next.status === BillStatus.HOLD
                  ? await resumeBill(next.id).unwrap()
                  : await fetchBill(next.id);
              syncFromBill(bill);
            } else {
              await startNewBill();
            }
          }
          void refetchTabs();
          setMessage(`Bill sent to ${result.counterName} (${result.assignedToUsername})`);
        }, 'Transferring bill…');
      } catch (e) {
        setError(getApiErrorMessage(e, 'Could not transfer bill'));
      }
    },
    [
      transferBillId,
      billId,
      tabs,
      transferBill,
      clearBill,
      resumeBill,
      syncFromBill,
      startNewBill,
      refetchTabs,
      runBusy,
    ],
  );

  const transferTab = transferBillId ? tabs.find((t) => t.id === transferBillId) : null;

  const handleParkAndNew = useCallback(async () => {
    setError('');
    const id = useBillingStore.getState().billId;
    if (!id) {
      setError('Bill not ready — wait a moment and try again');
      return;
    }
    try {
      await runBusy(async () => {
        if (items.length > 0) {
          if (!isEditable) {
            throw new Error('This bill cannot be parked');
          }
          await holdBill(id).unwrap();
          await refetchTabs();
          await startNewBill();
          setMessage('Bill parked — open it from the orange tab above');
        } else {
          await startNewBill();
          setMessage('New walk-in bill started');
        }
      }, items.length > 0 ? 'Parking bill…' : 'Starting new bill…');
    } catch (e) {
      setError(getApiErrorMessage(e, items.length > 0 ? 'Park failed' : 'Could not start new bill'));
    }
  }, [items.length, isEditable, holdBill, startNewBill, refetchTabs, runBusy, setError, setMessage]);

  const handleScan = useCallback(
    async (barcode: string) => {
      if (!barcode.trim() || !isEditable) return;
      setError('');
      const code = barcode.trim();
      try {
        if (!online && counterId) {
          const id = ensureBillId();
          await enqueueOfflineAction(counterId, {
            type: 'scan',
            billId: id,
            barcode: code,
            qty: 1,
          });
          setMessage(`Offline — scan queued (${code})`);
          barcodeRef.current?.focus();
          return;
        }
        await runBusy(async () => {
          const id = ensureBillId();
          const catalog = await searchCatalog(code).unwrap();
          const resolved = resolveCatalogScan(code, catalog);

          if (resolved.kind === 'pick_batch') {
            setBatchPickProduct(resolved.product);
            setProductModalOpen(true);
            setMessage(`Choose batch for ${resolved.product.name} (F8)`);
            return;
          }

          if (resolved.kind === 'add') {
            const bill = await addProductLine({
              billId: id,
              body: { productId: resolved.productId, batchId: resolved.batchId, qty: 1 },
            }).unwrap();
            syncFromBill(bill);
            void refetchTabs();
            barcodeRef.current?.focus();
            return;
          }

          const bill = await scanBarcode({
            billId: id,
            body: { barcode: code, qty: 1 },
          }).unwrap();
          syncFromBill(bill);
          void refetchTabs();
          barcodeRef.current?.focus();
        }, 'Adding item…');
      } catch (e) {
        if (dismissIfBillClosed(e)) {
          barcodeRef.current?.focus();
          return;
        }
        setError(getApiErrorMessage(e, 'Scan failed'));
        barcodeRef.current?.select();
      }
    },
    [
      ensureBillId,
      searchCatalog,
      addProductLine,
      scanBarcode,
      syncFromBill,
      refetchTabs,
      isEditable,
      runBusy,
      online,
      counterId,
      setMessage,
      dismissIfBillClosed,
    ],
  );

  const openPayment = useCallback(async () => {
    if (!online) {
      setError('Payment requires internet connection');
      return;
    }
    if (items.length === 0) {
      setError('Add at least one item before payment');
      return;
    }
    if (!hasRealCustomer) {
      setError('Select a customer before payment');
      setCustomerModalOpen(true);
      return;
    }
    if (billHasShortage) {
      setError('Resolve stock shortages before payment');
      return;
    }
    setError('');
    try {
      const id = ensureBillId();
      const bill = await fetchBill(id);
      syncFromBill(bill);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not load bill totals — try again'));
      return;
    }
    setPayOpen(true);
  }, [items.length, online, hasRealCustomer, billHasShortage, ensureBillId, syncFromBill, setError]);

  const handleApplyBillDiscount = useCallback(
    async (body: { amount?: number; percent?: number }) => {
      const id = ensureBillId();
      const bill = await setBillDiscount({ billId: id, body }).unwrap();
      syncFromBill(bill);
    },
    [ensureBillId, setBillDiscount, syncFromBill],
  );

  const handlePaymentComplete = useCallback(
    async (body: CompleteBillDto) => {
      setError('');
      await runBusy(async () => {
        const id = ensureBillId();
        const idempotencyKey =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${id}-${Date.now()}`;
        const result = await completeBill({ billId: id, body, idempotencyKey }).unwrap();
        lastCompletedBillId.current = id;
        setPayOpen(false);
        const change =
          result.balanceReturn != null && result.balanceReturn > 0
            ? ` · Change ₹${result.balanceReturn.toFixed(2)}`
            : '';
        setMessage(`Completed — ${result.invoiceNo ?? 'processing stock…'}${change}`);
        clearBill();
        await startNewBill();
        void refetchTabs();
        window.setTimeout(() => {
          if (lastCompletedBillId.current) {
            void openPrintForBill(lastCompletedBillId.current);
          }
        }, 2500);
      }, 'Completing bill…');
    },
    [runBusy, ensureBillId, completeBill, clearBill, startNewBill, refetchTabs, openPrintForBill],
  );

  const handleRemoveLine = useCallback(
    async (lineId: string) => {
      if (!isEditable) return;
      const removed = items.find((i) => i.id === lineId);
      const batchId = removed?.batchId;
      try {
        await runBusy(async () => {
          const id = ensureBillId();
          const bill = await removeLine({ billId: id, lineId }).unwrap();
          syncFromBill(bill);
          setLineShortageHints((prev) => {
            if (!prev[lineId]) return prev;
            const next = { ...prev };
            delete next[lineId];
            return next;
          });
          if (batchId) dispatch(clearBatchShortageAlert(batchId));
          dispatch(clearShortageAlertsForBill(id));
          if (selectedLineId === lineId) {
            setSelectedLineId(null);
            setLineQtyDraft(null);
          }
          if (stockHintLineId === lineId) setStockHintLineId(null);
          void refetchTabs();
        }, 'Removing line…');
      } catch (e) {
        setError(getApiErrorMessage(e, 'Remove failed'));
      }
    },
    [
      ensureBillId,
      removeLine,
      syncFromBill,
      refetchTabs,
      isEditable,
      selectedLineId,
      runBusy,
      items,
      dispatch,
      stockHintLineId,
    ],
  );

  const handleAddProduct = useCallback(
    async (productId: string, batchId: string) => {
      if (!isEditable) return;
      setError('');
      try {
        await runBusy(async () => {
          const id = ensureBillId();
          const bill = await addProductLine({
            billId: id,
            body: { productId, batchId, qty: 1 },
          }).unwrap();
          syncFromBill(bill);
          void refetchTabs();
          barcodeRef.current?.focus();
        }, 'Adding item…');
      } catch (e) {
        setError(getApiErrorMessage(e, 'Could not add product'));
      }
    },
    [ensureBillId, addProductLine, syncFromBill, refetchTabs, isEditable, runBusy],
  );

  const handleCustomerSelect = useCallback(
    async (
      selectedId: string,
      name: string,
      mobile?: string | null,
      gst?: string | null,
      pan?: string | null,
      email?: string | null,
      address?: string | null,
    ) => {
      if (!isEditable) return;
      try {
        await runBusy(async () => {
          const id = ensureBillId();
          const bill = await setBillCustomer({ billId: id, body: { customerId: selectedId } }).unwrap();
          syncFromBill(bill);
          setCustomer(
            selectedId,
            bill.customerName ?? name,
            bill.customerMobile ?? mobile,
            bill.customerGst ?? gst,
            bill.customerPan ?? pan,
            bill.customerEmail ?? email,
            bill.customerAddress ?? address,
          );
          void refetchTabs();
        }, 'Updating customer…');
      } catch (e) {
        setError(getApiErrorMessage(e, 'Customer update failed'));
      }
    },
    [ensureBillId, setBillCustomer, syncFromBill, setCustomer, refetchTabs, isEditable, runBusy],
  );

  const selectLineByIndex = useCallback(
    (index: number) => {
      if (!isEditable || items.length === 0) return;
      const clamped = Math.max(0, Math.min(index, items.length - 1));
      setSelectedLineId(items[clamped].id);
    },
    [items, isEditable],
  );

  const deselectLine = useCallback(() => {
    setSelectedLineId(null);
    setProductModalOpen(false);
    setCustomerModalOpen(false);
    barcodeRef.current?.focus();
  }, []);

  const focusLineQty = useCallback(() => {
    window.setTimeout(() => {
      lineQtyRef.current?.focus();
      lineQtyRef.current?.select();
    }, 0);
  }, []);

  useEffect(() => {
    if (!selectedLineId || !isEditable) return;
    focusLineQty();
  }, [selectedLineId, isEditable, focusLineQty]);

  const [lineDiscMode, setLineDiscMode] = useState<'amount' | 'percent'>('amount');
  const [lineQtyDraft, setLineQtyDraft] = useState<number | null>(null);

  const selectedQtyHint = selectedLineId ? lineShortageHints[selectedLineId] : undefined;

  useEffect(() => {
    if (!selectedLineId) {
      setLineQtyDraft(null);
      return;
    }
    const line = useBillingStore.getState().items.find((i) => i.id === selectedLineId);
    setLineQtyDraft(selectedQtyHint?.attemptedQty ?? line?.qty ?? null);
  }, [selectedLineId, selectedQtyHint?.attemptedQty]);

  /** Drop hints/alerts when line removed or batch no longer on this bill. */
  useEffect(() => {
    const lineIds = new Set(items.map((i) => i.id));
    const batchOnBill = new Set(items.map((i) => i.batchId).filter(Boolean) as string[]);

    setLineShortageHints((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (!lineIds.has(id)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    for (const [batchId, alert] of Object.entries(batchShortageAlerts)) {
      const lineGone = alert.lineId != null && !lineIds.has(alert.lineId);
      const batchGone = !batchOnBill.has(batchId);
      if (lineGone || (batchGone && alert.billId === billId)) {
        dispatch(clearBatchShortageAlert(batchId));
      }
    }
  }, [items, batchShortageAlerts, billId, dispatch]);

  const applyQtyShortageHint = useCallback(
    (
      lineId: string,
      line: { qty: number; availableQty?: number; stockQty?: number; pendingQty?: number },
      attemptedQty: number,
    ) => {
      let short = calcShortageForAttemptedQty(attemptedQty, {
        qty: line.qty,
        availableQty: line.availableQty,
        stockQty: line.stockQty,
        pendingQty: line.pendingQty,
      });
      if (short > 0) {
        setLineShortageHints((prev) => ({
          ...prev,
          [lineId]: { short, attemptedQty },
        }));
      } else {
        setLineShortageHints((prev) => {
          if (!prev[lineId]) return prev;
          const next = { ...prev };
          delete next[lineId];
          return next;
        });
      }
    },
    [],
  );

  const applyLineUpdate = useCallback(
    async (patch: { qty?: number; discount?: number; discountPercent?: number }) => {
      if (!selectedLineId || !isEditable) return;
      const lineId = selectedLineId;
      const reqId = ++lineQtyApplyRef.current;
      if (patch.qty !== undefined) {
        patchLineLocally(lineId, { qty: patch.qty });
      }
      try {
        const id = ensureBillId();
        const bill = await updateLine({ billId: id, lineId, body: patch }).unwrap();
        if (reqId !== lineQtyApplyRef.current) return;
        setStockHintLineId(null);
        if (patch.qty !== undefined) {
          setLineQtyDraft(patch.qty);
          const updated = bill.items.find((i) => i.id === lineId);
          if (updated) {
            const short =
              updated.shortageQty != null && updated.shortageQty > 0.001
                ? updated.shortageQty
                : calcShortageForAttemptedQty(patch.qty, {
                    qty: updated.qty,
                    availableQty: updated.availableQty,
                    stockQty: updated.stockQty,
                    pendingQty: updated.pendingQty,
                    reservedQty: updated.reservedQty,
                    shortageQty: updated.shortageQty,
                  });
            if (short > 0.001) {
              setLineShortageHints((prev) => ({
                ...prev,
                [lineId]: { short, attemptedQty: patch.qty! },
              }));
            } else {
              setLineShortageHints((prev) => {
                if (!prev[lineId]) return prev;
                const next = { ...prev };
                delete next[lineId];
                return next;
              });
            }
          }
        }
        syncFromBill(bill);
        void refetchTabs();
      } catch (e) {
        if (reqId !== lineQtyApplyRef.current) return;
        if (dismissIfBillClosed(e)) return;
        const msg = getApiErrorMessage(e, 'Update failed');
        if (isInsufficientStockError(msg) && patch.qty != null) {
          setLineQtyDraft(patch.qty);
          setStockHintLineId(lineId);
          const line = items.find((i) => i.id === lineId);
          const avail = line ? parseInsufficientStockAvailable(msg) : null;
          const short =
            avail != null && line
              ? Math.max(0, round2(patch.qty - line.qty - avail))
              : calcShortageForAttemptedQty(patch.qty, line ?? { qty: patch.qty });
          if (short > 0.001) {
            setLineShortageHints((prev) => ({
              ...prev,
              [lineId]: { short, attemptedQty: patch.qty! },
            }));
          }
          try {
            const id = ensureBillId();
            await publishShortageAlert({
              billId: id,
              lineId,
              attemptedQty: patch.qty!,
            }).unwrap();
          } catch {
            /* WS alert is best-effort when legacy API rejects qty */
          }
          setError(
            'Stock is short — qty kept on the bill; other counters are alerted. Restart the API if qty does not save.',
          );
          return;
        }
        if (patch.qty !== undefined) {
          const prior = items.find((i) => i.id === lineId);
          if (prior) patchLineLocally(lineId, { qty: prior.qty });
        }
        setStockHintLineId(null);
        setError(msg);
      }
    },
    [
      selectedLineId,
      isEditable,
      ensureBillId,
      updateLine,
      publishShortageAlert,
      patchLineLocally,
      syncFromBill,
      refetchTabs,
      dismissIfBillClosed,
      setError,
      items,
    ],
  );

  const commitLineQty = useCallback(
    async (qty: number) => {
      if (!selectedLineId || !isEditable) return;
      await applyLineUpdate({ qty });
    },
    [selectedLineId, isEditable, applyLineUpdate],
  );

  const finishLineEdit = useCallback(async () => {
    if (lineQtyDraft != null && selectedLineId) {
      await applyLineUpdate({ qty: lineQtyDraft });
    }
    deselectLine();
  }, [lineQtyDraft, selectedLineId, applyLineUpdate, deselectLine]);

  const closeModals = useCallback(() => {
    setProductModalOpen(false);
    setCustomerModalOpen(false);
    barcodeRef.current?.focus();
  }, []);

  const handlers = useMemo(
    () => ({
      onFocusScan: () => {
        closeModals();
        barcodeRef.current?.focus();
      },
      onProductSearch: () => {
        setCustomerModalOpen(false);
        setProductModalOpen(true);
      },
      onSelectCustomer: () => {
        setProductModalOpen(false);
        setCustomerModalOpen(true);
      },
      onHoldBill: () => void handleParkAndNew(),
      onCompleteBill: () => openPayment(),
      onPayment: () => openPayment(),
      onEditQty: () => {
        if (!selectedLineId && items.length) {
          setSelectedLineId(items[0].id);
          return;
        }
        lineQtyRef.current?.focus();
        lineQtyRef.current?.select();
      },
      onDeselectLine: deselectLine,
      onDeleteLine: () => {
        const target = selectedLineId
          ? items.find((i) => i.id === selectedLineId)
          : items[items.length - 1];
        if (target) void handleRemoveLine(target.id);
      },
      onLineUp: () => {
        if (items.length === 0) return;
        if (!selectedLineId) {
          selectLineByIndex(items.length - 1);
          return;
        }
        const idx = items.findIndex((i) => i.id === selectedLineId);
        selectLineByIndex(idx <= 0 ? 0 : idx - 1);
      },
      onLineDown: () => {
        if (!isEditable || items.length === 0) return;
        if (!selectedLineId) {
          selectLineByIndex(0);
          return;
        }
        const idx = items.findIndex((i) => i.id === selectedLineId);
        selectLineByIndex(idx < 0 ? 0 : Math.min(idx + 1, items.length - 1));
      },
      onSelectLineNumber: (n: number) => {
        if (!isEditable) return;
        if (n >= 1 && n <= items.length) selectLineByIndex(n - 1);
      },
      onPrint: () => setReprintOpen(true),
    }),
    [
      handleParkAndNew,
      openPayment,
      items,
      handleRemoveLine,
      selectedLineId,
      isEditable,
      billId,
      status,
      deselectLine,
      selectLineByIndex,
      closeModals,
      focusLineQty,
    ],
  );

  useKeyboardShortcuts(handlers);

  const handleBarcodeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    void handleScan(String(fd.get('barcode') || ''));
    e.currentTarget.reset();
  };

  if (!counterId) {
    return (
      <div className="alert alert-warning m-2">
        <h5 className="alert-heading">No counter for this machine</h5>
        <p className="mb-0 small">Sign in from your counter PC.</p>
      </div>
    );
  }

  return (
    <div className={`pharmacy-pos billing-pos${isBusy ? ' billing-pos--dimmed' : ''}`}>
      <WsConnectionStrip />
      <BillingBusyOverlay active={isBusy} message={busyLabel} />
      <OfflineBanner
        online={online}
        pendingCount={pendingCount}
        syncing={syncing}
        onSyncNow={() => void flushQueue().then((r) => setMessage(`Synced ${r.ok} action(s)`))}
      />
      <div className="billing-pos__shell">
        <BillingKeyboardHelp />
        <div className="billing-pos__workspace">
          <BillTabs
            tabs={tabs}
        activeId={billId}
        emptyDraftCount={emptyDraftCount}
        onSelect={(id) => void switchToBill(id)}
        onNewBill={() => void handleParkAndNew()}
        onCloseTab={(id) => void handleCloseTab(id)}
        onCleanupEmpty={() => void handleCleanupEmpty()}
        onTransfer={(id) => handleOpenTransfer(id)}
            disabled={isBusy}
          />

          {(message || error) && (
            <div
              className={`billing-pos__toast ${error ? 'billing-pos__toast--error' : 'billing-pos__toast--info'}`}
            >
              {error || message}
              {invoiceNo && !error ? ` · ${invoiceNo}` : ''}
            </div>
          )}

          <div className="billing-pos__body">
        <div className="billing-pos__col billing-pos__col--scan">
          <div className="billing-panel billing-panel--compact">
            <div className="billing-panel__head">
              <span>
                Scan <kbd className="pharmacy-kbd">F1</kbd>
              </span>
            </div>
            <div className="billing-panel__body">
              <form onSubmit={handleBarcodeSubmit}>
                <input
                  ref={barcodeRef}
                  name="barcode"
                  className="form-control billing-barcode-input mb-2"
                  placeholder="Barcode"
                  autoComplete="off"
                  disabled={isBusy || !billId || !isEditable}
                />
              </form>
              <button
                type="button"
                className="btn btn-outline-secondary btn-block btn-sm"
                disabled={isBusy || !billId || !isEditable}
                onClick={() => setProductModalOpen(true)}
              >
                Find product <kbd className="ml-1">F8</kbd>
              </button>
              <button
                type="button"
                className="btn btn-outline-info btn-block btn-sm mt-2"
                disabled={isBusy}
                onClick={() => setReprintOpen(true)}
              >
                Find invoice / print <kbd className="ml-1">F7</kbd>
              </button>
              <div className="billing-pos__scan-stats mt-2">
                <div>
                  <span className="text-muted">Lines</span> <strong>{items.length}</strong>
                </div>
                <div>
                  <span className="text-muted">Due</span>{' '}
                  <strong className="text-teal">₹{effectiveGrandTotal.toFixed(2)}</strong>
                </div>
              </div>
              {updatingLine && (
                <p className="small text-primary mb-0 mt-2">
                  <span className="spinner-border spinner-border-sm mr-1" role="presentation" />
                  Updating line…
                </p>
              )}

            </div>
          </div>
        </div>

        <div className="billing-pos__col billing-pos__col--items">
          <div className="billing-panel billing-panel--fill">
            <div className="billing-panel__head billing-panel__head--items">
              <span>Items ({items.length})</span>
              <div className="billing-panel__head-right">
                <BillingAlertsStrip
                  items={items}
                  connected={wsConnected}
                  grandTotal={effectiveGrandTotal}
                />
                {!isEditable && status && (
                  <span className="badge badge-secondary">{status}</span>
                )}
                {!isEditable && !status && items.length > 0 && (
                  <span className="badge badge-warning">Read-only</span>
                )}
              </div>
            </div>
            <div className="billing-items-wrap">
              <table className="table table-sm table-striped billing-item-grid mb-0">
                <thead className="thead-dark sticky-top">
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th className="text-right">Qty</th>
                    <th className="billing-th-stock">Availability</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Disc</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-muted py-3">
                        Scan barcode or <kbd>F8</kbd> find product
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => (
                      <tr
                        key={item.id}
                        className={[
                          item.id === selectedLineId ? 'billing-line--selected' : '',
                          lineItemHasShortage(
                            item,
                            lineShortageHints,
                            item.batchId ? batchShortageAlerts[item.batchId] : undefined,
                            { billId, lineId: item.id },
                          )
                            ? 'billing-line--shortage'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ') || undefined}
                        tabIndex={isEditable ? 0 : -1}
                        onFocus={() => {
                          if (isEditable) setSelectedLineId(item.id);
                        }}
                      >
                        <td>{idx + 1}</td>
                        <td className="text-truncate" style={{ maxWidth: 160 }}>
                          {item.productName}
                          {item.batchNumber ? (
                            <small className="d-block text-muted">{item.batchNumber}</small>
                          ) : null}
                        </td>
                        <td className="text-right">
                          {displayLineQty(item, {
                            selectedLineId,
                            lineQtyDraft,
                            attemptedQty:
                              lineShortageHints[item.id]?.attemptedQty ??
                              (item.shortageQty != null && item.shortageQty > 0
                                ? item.qty
                                : undefined),
                          })}
                        </td>
                        <td>
                          <LineStockIndicators
                            billId={billId}
                            lineId={item.id}
                            batchId={item.batchId}
                            batchNumber={item.batchNumber}
                            productName={item.productName}
                            lineQty={displayLineQty(item, {
                              selectedLineId,
                              lineQtyDraft,
                              attemptedQty: lineShortageHints[item.id]?.attemptedQty,
                            })}
                            availableQty={item.availableQty}
                            pendingQty={item.pendingQty}
                            stockQty={item.stockQty}
                            forceDetails={item.id === stockHintLineId}
                            shortageOverride={
                              lineShortageHints[item.id]?.short ??
                              batchShortageAlerts[item.batchId!]?.shortageQty
                            }
                            attemptedQty={
                              lineShortageHints[item.id]?.attemptedQty ??
                              batchShortageAlerts[item.batchId!]?.attemptedQty
                            }
                            batchShortageAlert={
                              item.batchId ? batchShortageAlerts[item.batchId] : undefined
                            }
                          />
                        </td>
                        <td className="text-right">{item.rate.toFixed(2)}</td>
                        <td className="text-right billing-td-disc">
                          {item.discount > 0 ? (
                            <>
                              −{item.discount.toFixed(2)}
                              {item.qty * item.rate > 0 && (
                                <small className="d-block text-muted">
                                  {round2((item.discount / (item.qty * item.rate)) * 100)}%
                                </small>
                              )}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="text-right">{item.lineTotal.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {selectedLine && isEditable && (
              <div
                className="billing-line-edit"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    deselectLine();
                  }
                }}
              >
                <small className="text-muted d-block mb-1">
                  Line {items.findIndex((i) => i.id === selectedLineId) + 1} · ↑↓ line · Tab next · Enter
                  done · Esc
                </small>
                <div className="billing-line-edit__row">
                  <label className="small mb-0" htmlFor="line-qty">
                    Qty
                  </label>
                  <NumericInput
                    id="line-qty"
                    inputRef={lineQtyRef}
                    className="form-control form-control-sm"
                    value={lineQtyDraft ?? selectedLine.qty}
                    onChange={(qty) => {
                      setLineQtyDraft(qty);
                      if (selectedLineId) {
                        applyQtyShortageHint(selectedLineId, selectedLine, qty);
                      }
                    }}
                    onAfterBlur={(qty) => {
                      void commitLineQty(qty);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.currentTarget.blur();
                        lineDiscRef.current?.focus();
                        lineDiscRef.current?.select();
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        deselectLine();
                      }
                    }}
                  />
                  <DiscountField
                    id="line-disc"
                    inputRef={lineDiscRef}
                    label="Line discount"
                    mode={lineDiscMode}
                    onModeChange={setLineDiscMode}
                    amount={selectedLine.discount}
                    gross={lineGross(selectedLine.qty, selectedLine.rate)}
                    disabled={isBusy}
                    compact
                    hint="Auto from product/batch master until you click Set"
                    onApply={(patch) =>
                      void applyLineUpdate({
                        ...(patch.amount !== undefined ? { discount: patch.amount } : {}),
                        ...(patch.discountPercent !== undefined
                          ? { discountPercent: patch.discountPercent }
                          : {}),
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        deselectLine();
                      }
                    }}
                  />
                  <button
                    ref={lineDoneRef}
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={isBusy}
                    onClick={() => void finishLineEdit()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void finishLineEdit();
                      }
                    }}
                  >
                    Done
                  </button>
                </div>
                {selectedLineId && lineShortageHints[selectedLineId]?.short > 0 && (
                  <p className="billing-line-edit__short-warn small mb-0 mt-2" role="alert">
                    <i className="fas fa-triangle-exclamation mr-1" aria-hidden />
                    Need {lineShortageHints[selectedLineId].attemptedQty} — short by{' '}
                    <strong>{lineShortageHints[selectedLineId].short}</strong>. Press Tab or{' '}
                    <strong>Done</strong> to save qty and alert all counters
                    {wsConnected ? '' : ' (Live off — check Redis & API)'}.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="billing-pos__col billing-pos__col--pay">
          <div className="billing-panel billing-panel--compact">
            <div className="billing-panel__head d-flex justify-content-between align-items-center">
              <span className="text-truncate" title={customerName}>
                <kbd>F2</kbd> {customerName}
              </span>
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-nowrap"
                disabled={!isEditable || isBusy}
                onClick={() => setCustomerModalOpen(true)}
              >
                Change
              </button>
            </div>
            {customerMobile && (
              <div className="billing-panel__body py-2 small text-muted">{customerMobile}</div>
            )}
          </div>

          <div className="billing-panel billing-panel--fill billing-panel--payment">
            <div className="billing-panel__head">Payment (F5)</div>
            <div className="billing-panel__body">
              <div className="billing-totals">
                {paymentTotals.lineDiscountTotal > 0.005 && (
                  <div className="d-flex justify-content-between small text-muted">
                    <span>Gross</span>
                    <span>
                      ₹ {(paymentTotals.subtotal + paymentTotals.lineDiscountTotal).toFixed(2)}
                    </span>
                  </div>
                )}
                {paymentTotals.lineDiscountTotal > 0 && (
                  <div className="d-flex justify-content-between small text-success">
                    <span>Line disc.</span>
                    <span>− ₹ {paymentTotals.lineDiscountTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="d-flex justify-content-between small">
                  <span>{paymentTotals.lineDiscountTotal > 0.005 ? 'Taxable' : 'Subtotal'}</span>
                  <span>₹ {paymentTotals.subtotal.toFixed(2)}</span>
                </div>
                {(paymentTotals.cgstTotal + paymentTotals.sgstTotal + paymentTotals.igstTotal) >
                  0.005 && (
                  <div className="d-flex justify-content-between small">
                    <span>GST</span>
                    <span>
                      + ₹{' '}
                      {(
                        paymentTotals.cgstTotal +
                        paymentTotals.sgstTotal +
                        paymentTotals.igstTotal
                      ).toFixed(2)}
                    </span>
                  </div>
                )}
                {paymentTotals.billDiscount > 0 && (
                  <div className="d-flex justify-content-between small text-success">
                    <span>Bill disc.</span>
                    <span>− ₹ {paymentTotals.billDiscount.toFixed(2)}</span>
                  </div>
                )}
                {paymentTotals.roundOff !== 0 && (
                  <div className="d-flex justify-content-between small text-warning">
                    <span>Round off</span>
                    <span>
                      {paymentTotals.roundOff >= 0 ? '+' : ''}
                      {paymentTotals.roundOff.toFixed(2)}
                    </span>
                  </div>
                )}
                {Math.abs(roundOff) >= 0.005 && (
                  <div className="d-flex justify-content-between small text-muted">
                    <span>Exact (incl. GST)</span>
                    <span>₹ {effectiveExactDue.toFixed(2)}</span>
                  </div>
                )}
                <div className="d-flex justify-content-between h5 font-weight-bold text-primary mt-1 mb-1">
                  <span>Due</span>
                  <span>₹ {effectiveGrandTotal.toFixed(2)}</span>
                </div>
                {totalsStale && (
                  <p className="small text-warning mb-1">Totals refreshed from line items.</p>
                )}
                {isEditable && Math.abs(effectiveGrandTotal - effectiveExactDue) < 0.01 && (
                  <div className="billing-round-actions mb-2">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm btn-block"
                      disabled={isBusy}
                      onClick={() => void handleApplyRoundOff('nearest')}
                    >
                      Round to ₹{roundedDue} (cash)
                    </button>
                  </div>
                )}
                {isEditable && roundOff !== 0 && (
                  <button
                    type="button"
                    className="btn btn-link btn-sm btn-block p-0 mb-2 text-left"
                    disabled={isBusy}
                    onClick={() => void handleApplyRoundOff('none')}
                  >
                    Use exact ₹{effectiveExactDue.toFixed(2)} (UPI/card)
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-success btn-block btn-lg"
                  disabled={
                    isBusy || items.length === 0 || !isEditable || !hasRealCustomer || billHasShortage
                  }
                  onClick={openPayment}
                  title={
                    !hasRealCustomer
                      ? 'Select a customer (F2) before payment'
                      : billHasShortage
                        ? 'Resolve stock shortages before payment'
                        : undefined
                  }
                >
                  Pay (F5)
                </button>
                <button
                  type="button"
                  className="btn btn-warning btn-block btn-sm mt-2"
                  disabled={isBusy || !isEditable}
                  onClick={() => void handleParkAndNew()}
                >
                  {holding ? 'Parking…' : 'Park & new bill (F4)'}
                </button>
              </div>
            </div>
          </div>
            </div>
          </div>
        </div>
      </div>

      <ProductSearchModal
        open={productModalOpen}
        preselectedProduct={batchPickProduct}
        disabled={isBusy || !billId || !isEditable}
        onClose={() => {
          setProductModalOpen(false);
          setBatchPickProduct(null);
          barcodeRef.current?.focus();
        }}
        onAdd={(productId, batchId) => {
          void handleAddProduct(productId, batchId);
          setProductModalOpen(false);
          setBatchPickProduct(null);
          barcodeRef.current?.focus();
        }}
      />

      <CustomerSearchModal
        open={customerModalOpen}
        disabled={!isEditable || isBusy}
        currentName={customerName}
        onClose={() => {
          setCustomerModalOpen(false);
          barcodeRef.current?.focus();
        }}
        onSelect={(id, name, mobile, gst, pan, email, address) => {
          void handleCustomerSelect(id, name, mobile, gst, pan, email, address);
          setCustomerModalOpen(false);
          barcodeRef.current?.focus();
        }}
      />

      <BillReprintModal
        open={reprintOpen}
        counterId={counterId}
        disabled={isBusy}
        onClose={() => {
          setReprintOpen(false);
          barcodeRef.current?.focus();
        }}
        onOpenInvoice={(id) => void openPrintForBill(id)}
      />

      <InvoicePrintModal
        open={printOpen}
        detail={invoiceDetail}
        accessToken={accessToken}
        onClose={() => {
          setPrintOpen(false);
          setInvoiceDetail(null);
          barcodeRef.current?.focus();
        }}
      />

      <BillTransferModal
        open={Boolean(transferBillId)}
        billLabel={transferTab?.customerName ?? 'Walk-in'}
        billMeta={
          transferTab
            ? `${transferTab.status === BillStatus.HOLD ? 'Parked' : 'Draft'} · ${transferTab.itemCount} items · ₹${transferTab.grandTotal.toFixed(0)}`
            : undefined
        }
        targets={onlineCounters}
        loading={loadingCounters}
        saving={transferring}
        onClose={() => setTransferBillId(null)}
        onTransfer={(targetCounterId) => void handleConfirmTransfer(targetCounterId)}
      />

      <PaymentModal
        open={payOpen}
        totals={paymentTotals}
        busy={completing || settingDiscount || settingRoundOff}
        onClose={() => setPayOpen(false)}
        onApplyRoundOff={async (mode) => {
          try {
            await handleApplyRoundOff(mode);
          } catch (e) {
            throw new Error(getApiErrorMessage(e, 'Could not update round-off'));
          }
        }}
        onApplyBillDiscount={async (body) => {
          try {
            await handleApplyBillDiscount(body);
          } catch (e) {
            throw new Error(getApiErrorMessage(e, 'Could not apply discount'));
          }
        }}
        onComplete={async (body) => {
          try {
            await handlePaymentComplete(body);
          } catch (e) {
            throw new Error(getApiErrorMessage(e, 'Payment failed'));
          }
        }}
      />
    </div>
  );
}

