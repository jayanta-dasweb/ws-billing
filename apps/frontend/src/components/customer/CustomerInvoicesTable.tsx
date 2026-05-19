'use client';

import Link from 'next/link';
import type { CustomerBillSummaryDto } from '@billing/shared';
import { formatBillDate, formatInr } from './customerFormat';

interface CustomerInvoicesTableProps {
  bills: CustomerBillSummaryDto[];
  compact?: boolean;
}

export function CustomerInvoicesTable({ bills, compact }: CustomerInvoicesTableProps) {
  if (bills.length === 0) {
    return (
      <div className="text-center text-muted py-4 small">
        No invoices yet. Your purchases will appear here after billing at the store.
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className={`table table-hover mb-0${compact ? ' table-sm' : ''}`}>
        <thead className="thead-light">
          <tr>
            <th>Invoice</th>
            <th>Date</th>
            <th className="text-right">Items</th>
            <th className="text-right">Amount</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {bills.map((b) => (
            <tr key={b.id} className="customer-invoice-row">
              <td className="font-weight-bold">{b.invoiceNo ?? '—'}</td>
              <td>{formatBillDate(b.committedAt ?? b.createdAt)}</td>
              <td className="text-right">{b.itemCount}</td>
              <td className="text-right font-weight-bold">{formatInr(b.grandTotal)}</td>
              <td className="text-right">
                <Link
                  href={`/customer/invoices/${b.id}`}
                  className="btn btn-sm btn-outline-primary"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
