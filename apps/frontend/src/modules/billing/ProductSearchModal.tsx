'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import type { CatalogBatchDto, CatalogProductDto } from '@billing/shared';
import { useLazySearchCatalogQuery } from '@/services/api/billingApi';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { RootState } from '@/redux/store';
import {
  daysUntilExpiry,
  EXPIRY_RISK_SORT,
  expiryRiskLabel,
  getExpiryRisk,
  worstExpiryRisk,
  type ExpiryRisk,
} from '@/utils/batchExpiry';
import { StockMetricsPair } from '@/components/billing/StockMetrics';

const PRODUCT_GRID_COLS = 2;

interface ProductSearchModalProps {
  open: boolean;
  disabled?: boolean;
  /** When set, opens directly on the batch list (e.g. scan found multiple batches). */
  preselectedProduct?: CatalogProductDto | null;
  onClose: () => void;
  onAdd: (productId: string, batchId: string) => void;
}

type EnrichedBatch = CatalogBatchDto & { live: boolean; risk: ExpiryRisk; daysLeft: number | null };

function mergeLiveStock(batch: CatalogBatchDto, live?: { stockQty: number; pendingQty: number; availableQty: number }): EnrichedBatch {
  const risk = getExpiryRisk(batch.expiryDate);
  const daysLeft = daysUntilExpiry(batch.expiryDate);
  if (!live) {
    return { ...batch, live: false, risk, daysLeft };
  }
  return {
    ...batch,
    stockQty: live.stockQty,
    pendingQty: live.pendingQty,
    availableQty: live.availableQty,
    live: true,
    risk,
    daysLeft,
  };
}

export function ProductSearchModal({
  open,
  disabled,
  preselectedProduct,
  onClose,
  onAdd,
}: ProductSearchModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 280);
  const [step, setStep] = useState<'products' | 'batches'>('products');
  const [picked, setPicked] = useState<CatalogProductDto | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const [search, { data: results = [], isFetching, reset: resetSearch }] =
    useLazySearchCatalogQuery();

  const stockBatches = useSelector((s: RootState) => s.stock.batches);
  const stockLastUpdated = useSelector((s: RootState) => s.stock.lastUpdated);

  const searchActive = debouncedQuery.trim().length >= 2;
  const products = useMemo(
    () => (searchActive ? (results as CatalogProductDto[]) : []),
    [results, searchActive],
  );

  const productCards = useMemo(
    () =>
      products.map((p) => ({
        ...p,
        worstRisk: worstExpiryRisk(p.batches),
        totalAvail: p.batches.reduce((s, b) => s + b.availableQty, 0),
      })),
    [products],
  );

  const displayBatches = useMemo((): EnrichedBatch[] => {
    if (!picked) return [];
    return [...picked.batches]
      .map((b) => mergeLiveStock(b, stockBatches[b.id]))
      .sort((a, b) => {
        const rs = EXPIRY_RISK_SORT[a.risk] - EXPIRY_RISK_SORT[b.risk];
        if (rs !== 0) return rs;
        return (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999');
      });
  }, [picked, stockBatches]);

  const riskCounts = useMemo(() => {
    const c = { expired: 0, critical: 0, warning: 0 };
    for (const b of displayBatches) {
      if (b.risk === 'expired') c.expired++;
      else if (b.risk === 'critical') c.critical++;
      else if (b.risk === 'warning') c.warning++;
    }
    return c;
  }, [displayBatches]);

  useEffect(() => {
    if (!open) {
      resetSearch();
      return;
    }
    setQuery('');
    if (preselectedProduct) {
      setPicked(preselectedProduct);
      setStep('batches');
    } else {
      setStep('products');
      setPicked(null);
    }
    setFocusIdx(0);
    rowRefs.current = [];
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open, preselectedProduct, resetSearch]);

  useEffect(() => {
    if (!open || !searchActive) return;
    void search(debouncedQuery.trim());
  }, [open, debouncedQuery, searchActive, search]);

  useEffect(() => {
    if (step === 'products') setFocusIdx(0);
  }, [debouncedQuery, step, products.length]);

  useEffect(() => {
    if (step !== 'batches' || displayBatches.length === 0) return;
    const safe = displayBatches.findIndex((b) => b.risk !== 'expired');
    setFocusIdx(safe >= 0 ? safe : 0);
  }, [picked?.id, step, displayBatches.length]);

  useEffect(() => {
    if (!open || step !== 'batches' || !picked) return;
    const productId = picked.id;
    const productName = picked.name;
    const refresh = () => {
      void search(productName).then((result) => {
        if ('data' in result && result.data) {
          const fresh = (result.data as CatalogProductDto[]).find((p) => p.id === productId);
          if (fresh) setPicked(fresh);
        }
      });
    };
    refresh();
    const timer = window.setInterval(refresh, 4000);
    return () => window.clearInterval(timer);
  }, [open, step, picked?.id, picked?.name, search]);

  useEffect(() => {
    const el = rowRefs.current[focusIdx];
    if (!el) return;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusIdx, step, displayBatches.length]);

  const openBatches = useCallback((p: CatalogProductDto) => {
    if (p.batches.length === 0) return;
    setPicked(p);
    setStep('batches');
  }, []);

  const addBatch = useCallback(
    (b: EnrichedBatch) => {
      if (!picked) return;
      onAdd(picked.id, b.id);
      onClose();
    },
    [picked, onAdd, onClose],
  );

  const confirmProducts = useCallback(() => {
    const p = productCards[focusIdx];
    if (p) openBatches(p);
  }, [productCards, focusIdx, openBatches]);

  const confirmBatches = useCallback(() => {
    const b = displayBatches[focusIdx];
    if (b) addBatch(b);
  }, [displayBatches, focusIdx, addBatch]);

  const listLen = step === 'batches' ? displayBatches.length : productCards.length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (step === 'batches') {
          setStep('products');
          setPicked(null);
          setFocusIdx(0);
          window.setTimeout(() => inputRef.current?.focus(), 30);
        } else {
          onClose();
        }
        return;
      }
      if (e.target instanceof HTMLInputElement && e.target !== inputRef.current) return;

      const max = Math.max(0, listLen - 1);

      if (step === 'products') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusIdx((i) => Math.min(i + PRODUCT_GRID_COLS, max));
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusIdx((i) => Math.max(i - PRODUCT_GRID_COLS, 0));
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setFocusIdx((i) => (i % PRODUCT_GRID_COLS === PRODUCT_GRID_COLS - 1 ? i : Math.min(i + 1, max)));
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setFocusIdx((i) => (i % PRODUCT_GRID_COLS === 0 ? i : i - 1));
        }
      } else {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusIdx((i) => Math.min(i + 1, max));
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusIdx((i) => Math.max(i - 1, 0));
        }
      }
      if (e.key === 'Home') {
        e.preventDefault();
        setFocusIdx(0);
      }
      if (e.key === 'End') {
        e.preventDefault();
        setFocusIdx(max);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (step === 'batches') confirmBatches();
        else if (searchActive && productCards.length > 0) confirmProducts();
        else if (searchActive) void search(debouncedQuery.trim());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step, listLen, searchActive, debouncedQuery, search, confirmProducts, confirmBatches, onClose]);

  if (!open) return null;

  return (
    <div className="pharmacy-modal" role="dialog" aria-modal="true" aria-label="Find product">
      <button type="button" className="pharmacy-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div
        className={`pharmacy-modal__panel pharmacy-modal__panel--wide${
          step === 'batches' ? ' pharmacy-modal__panel--batches' : ''
        }`}
      >
        <div
          className={`pharmacy-modal__head${
            step === 'batches' ? ' pharmacy-modal__head--batches' : ''
          }`}
        >
          <span>
            {step === 'batches' && picked ? (
              <>
                Pick batch · <em>{picked.name}</em>
              </>
            ) : (
              'Find product'
            )}
          </span>
          {step === 'batches' && stockLastUpdated && (
            <span className="batch-picker__live" title="Qty updates from server + live counter">
              <span className="batch-picker__live-dot" /> Live stock
            </span>
          )}
          <kbd className="pharmacy-kbd">F8</kbd>
          <button type="button" className="pharmacy-modal__close" onClick={onClose}>
            Esc
          </button>
        </div>

        <div className="pharmacy-modal__body">
          {step === 'products' && (
            <>
              <input
                ref={inputRef}
                type="text"
                className="pharmacy-modal__input"
                placeholder="Product name, barcode, SKU, batch… (min 2 chars)"
                value={query}
                disabled={disabled}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (searchActive && productCards.length > 0) confirmProducts();
                    else if (searchActive) void search(debouncedQuery.trim());
                  }
                }}
              />
              <p className="pharmacy-modal__hint">
                {!searchActive
                  ? 'Type at least 2 characters — list updates as you type'
                  : isFetching
                    ? 'Searching…'
                    : productCards.length === 0
                      ? 'No products in stock for this search'
                      : '↑↓←→ grid · Enter → batches'}
              </p>
              <div ref={listRef} className="pharmacy-modal__list pharmacy-modal__list--product-grid">
                {!isFetching && searchActive && productCards.length === 0 && (
                  <p className="pharmacy-modal__empty">No products</p>
                )}
                <div className="product-picker__grid">
                  {productCards.map((p, idx) => (
                    <button
                      key={p.id}
                      ref={(el) => {
                        rowRefs.current[idx] = el;
                      }}
                      type="button"
                      className={[
                        'product-picker__card',
                        `product-picker__card--${p.worstRisk}`,
                        idx === focusIdx ? 'product-picker__card--active' : '',
                      ].join(' ')}
                      disabled={disabled || p.batches.length === 0}
                      onClick={() => openBatches(p)}
                    >
                      <span className="product-picker__name">{p.name}</span>
                      <span className="product-picker__sku">{p.sku ?? p.barcode ?? '—'}</span>
                      <span className="product-picker__foot">
                        <span className={`product-picker__batches product-picker__batches--${p.worstRisk}`}>
                          {p.batches.length} batch{p.batches.length !== 1 ? 'es' : ''}
                        </span>
                        <span className="product-picker__avail">Qty {Math.round(p.totalAvail)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 'batches' && picked && (
            <>
              <button
                type="button"
                className="pharmacy-modal__link mb-2"
                onClick={() => {
                  setStep('products');
                  setPicked(null);
                  setFocusIdx(0);
                  window.setTimeout(() => inputRef.current?.focus(), 30);
                }}
              >
                ← Back to products
              </button>

              <div className="batch-picker__legend" aria-label="Colour guide">
                <span className="batch-picker__legend-item batch-picker__legend-item--expired">Expired</span>
                <span className="batch-picker__legend-item batch-picker__legend-item--critical">≤30 days</span>
                <span className="batch-picker__legend-item batch-picker__legend-item--warning">≤90 days</span>
                <span className="batch-picker__legend-item batch-picker__legend-item--ok">Safe</span>
              </div>

              {(riskCounts.expired > 0 || riskCounts.critical > 0) && (
                <div className="batch-picker__alert" role="alert">
                  {riskCounts.expired > 0 && (
                    <span className="batch-picker__alert-bit batch-picker__alert-bit--expired">
                      {riskCounts.expired} EXPIRED — do not sell
                    </span>
                  )}
                  {riskCounts.critical > 0 && (
                    <span className="batch-picker__alert-bit batch-picker__alert-bit--critical">
                      {riskCounts.critical} near expiry
                    </span>
                  )}
                </div>
              )}

              <p className="pharmacy-modal__hint">
                ↑↓ moves · Enter adds · refreshes every 4s · Esc back
                {picked.gstPercent > 0 ? ` · GST ${picked.gstPercent}%` : ''}
              </p>

              <div ref={listRef} className="pharmacy-modal__list pharmacy-modal__list--batches">
                {displayBatches.map((b, idx) => {
                  const low = b.availableQty <= 5;
                  return (
                    <button
                      key={b.id}
                      ref={(el) => {
                        rowRefs.current[idx] = el;
                      }}
                      type="button"
                      className={[
                        'batch-picker__row',
                        `batch-picker__row--${b.risk}`,
                        idx === focusIdx ? 'batch-picker__row--active' : '',
                        low ? 'batch-picker__row--low' : '',
                      ].join(' ')}
                      disabled={disabled}
                      onClick={() => addBatch(b)}
                    >
                      <div className="batch-picker__row-top">
                        <strong className="batch-picker__batch-no">{b.batchNumber}</strong>
                        <span className="batch-picker__badges">
                          {(b.discountPercent > 0 || b.discountPerUnit > 0) && (
                            <span className="batch-picker__scheme">
                              {b.discountPercent > 0 && `${b.discountPercent}%`}
                              {b.discountPercent > 0 && b.discountPerUnit > 0 && ' + '}
                              {b.discountPerUnit > 0 && `₹${b.discountPerUnit}/u`}
                            </span>
                          )}
                          <span className={`batch-picker__badge batch-picker__badge--${b.risk}`}>
                            {expiryRiskLabel(b.risk, b.daysLeft)}
                          </span>
                        </span>
                      </div>
                      <StockMetricsPair
                        available={b.availableQty}
                        reserved={b.pendingQty}
                        live={b.live}
                        lowStock={low}
                        variant="dark"
                      />
                      <div className="batch-picker__row-grid batch-picker__row-grid--meta">
                        <div className="batch-picker__cell">
                          <span className="batch-picker__label">Expiry</span>
                          <span className={`batch-picker__val batch-picker__exp--${b.risk}`}>
                            {b.expiryDate
                              ? new Date(b.expiryDate).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </span>
                        </div>
                        <div className="batch-picker__cell">
                          <span className="batch-picker__label">MRP / Sell</span>
                          <span className="batch-picker__val">
                            ₹{b.mrp.toFixed(0)} / ₹{b.sellingPrice.toFixed(0)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}



