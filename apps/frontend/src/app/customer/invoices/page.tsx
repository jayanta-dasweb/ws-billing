'use client';

import { useMemo, useState } from 'react';
import { CustomerAuthGuard } from '@/components/customer/CustomerAuthGuard';
import { CustomerInvoicesTable } from '@/components/customer/CustomerInvoicesTable';
import { formatBillDate } from '@/components/customer/customerFormat';
import { PageSpinner } from '@/components/loading/PageSpinner';
import { useGetCustomerBillsQuery } from '@/services/api/customerAuthApi';

function InvoicesContent() {
  const { data: bills = [], isLoading } = useGetCustomerBillsQuery();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bills;
    return bills.filter(
      (b) =>
        (b.invoiceNo ?? '').toLowerCase().includes(q) ||
        formatBillDate(b.committedAt ?? b.createdAt).toLowerCase().includes(q),
    );
  }, [bills, search]);

  return (
    <div className="container py-4 customer-portal-content" style={{ maxWidth: 900 }}>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h4 mb-1">All invoices</h1>
          <p className="text-muted small mb-0">
            Complete list of your tax invoices with line items and GST breakdown.
          </p>
        </div>
        {!isLoading && (
          <span className="badge badge-primary badge-pill mt-2 mt-md-0">{bills.length} total</span>
        )}
      </div>

      <div className="card customer-stat-card mb-3">
        <div className="card-body py-3">
          <input
            type="search"
            className="form-control"
            placeholder="Search by invoice number or date…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card customer-stat-card">
        <div className="card-body p-0">
          {isLoading ? (
            <PageSpinner message="Loading invoices…" />
          ) : (
            <CustomerInvoicesTable bills={filtered} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function CustomerInvoicesPage() {
  return (
    <CustomerAuthGuard>
      <InvoicesContent />
    </CustomerAuthGuard>
  );
}
