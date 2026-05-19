'use client';



import type { BillSummaryDto } from '@billing/shared';

import { BillStatus } from '@billing/shared';

import { sortBillTabsStable } from '@/utils/sortBillTabs';

function tabClass(tab: BillSummaryDto, activeId: string | null): string {
  const base = 'billing-pos__tab';
  const isActive = tab.id === activeId;
  if (isActive) return `${base} billing-pos__tab--active`;
  if (tab.status === BillStatus.HOLD) return `${base} billing-pos__tab--hold`;
  return `${base} billing-pos__tab--idle`;
}



function statusLabel(status: BillSummaryDto['status']): string {

  return status === BillStatus.HOLD ? 'Parked' : 'Draft';

}



export function canCloseTab(tab: BillSummaryDto): boolean {

  return tab.status === BillStatus.DRAFT && tab.itemCount === 0;

}



interface BillTabsProps {
  tabs: BillSummaryDto[];
  activeId: string | null;
  emptyDraftCount: number;
  onSelect: (id: string) => void;
  onNewBill: () => void;
  onCloseTab: (id: string) => void;
  onCleanupEmpty: () => void;
  onTransfer?: (id: string) => void;
  disabled?: boolean;
}



export function BillTabs({

  tabs,

  activeId,

  emptyDraftCount,

  onSelect,

  onNewBill,

  onCloseTab,
  onCleanupEmpty,
  onTransfer,
  disabled,
}: BillTabsProps) {
  const orderedTabs = sortBillTabsStable(tabs);

  return (

    <div className="billing-pos__tabs-wrap">

      <div className="billing-pos__tabs">

        {emptyDraftCount > 1 && (

          <button

            type="button"

            className="billing-pos__tab-cleanup"

            onClick={onCleanupEmpty}

            disabled={disabled}

            title="Remove extra empty draft tabs"

          >

            Clear {emptyDraftCount} empty

          </button>

        )}

        {tabs.length === 0 && (

          <span className="billing-pos__tabs-empty text-muted small px-2">No open bills — use + New</span>

        )}

        {orderedTabs.map((tab) => {

          const closable = canCloseTab(tab);
          const transferable = Boolean(onTransfer) && tab.itemCount > 0;

          return (

            <div

              key={tab.id}

              className={`billing-pos__tab-wrap${tab.id === activeId ? ' billing-pos__tab-wrap--active' : ''}`}

            >

              <button

                type="button"

                className={tabClass(tab, activeId)}

                onClick={() => onSelect(tab.id)}

                disabled={disabled}

                title={`${statusLabel(tab.status)} · ${tab.customerName ?? 'Customer'} · ₹${tab.grandTotal.toFixed(0)}`}

              >

                <div className="font-weight-bold text-truncate">{tab.customerName ?? 'Walk-in'}</div>

                <div className="text-truncate">

                  {statusLabel(tab.status)} · {tab.itemCount} items · ₹{tab.grandTotal.toFixed(0)}

                </div>

              </button>

              {transferable && (
                <button
                  type="button"
                  className="billing-pos__tab-transfer"
                  disabled={disabled}
                  title="Transfer to another online counter"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTransfer!(tab.id);
                  }}
                >
                  <i className="fas fa-share" />
                </button>
              )}
              {closable && (
                <button
                  type="button"
                  className="billing-pos__tab-close"
                  disabled={disabled}
                  title="Close empty bill"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                >
                  ×
                </button>
              )}

            </div>

          );

        })}

        <button

          type="button"

          className="billing-pos__tab-new"

          onClick={onNewBill}

          disabled={disabled}

          title="Park current bill (if it has items) and start a new bill"

        >

          + New

        </button>

      </div>

    </div>

  );

}



