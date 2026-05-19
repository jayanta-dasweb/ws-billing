'use client';

import Link from 'next/link';
import { CustomerAuthGuard } from '@/components/customer/CustomerAuthGuard';
import { CustomerInvoicesTable } from '@/components/customer/CustomerInvoicesTable';
import { formatBillDate, formatInr } from '@/components/customer/customerFormat';
import { PageSpinner } from '@/components/loading/PageSpinner';
import { useGetCustomerDashboardQuery } from '@/services/api/customerAuthApi';

function ProductRankList({
  title,
  items,
  valueKey,
}: {
  title: string;
  items: { productName: string; totalQty: number; totalSpend: number; orderCount: number }[];
  valueKey: 'totalQty' | 'totalSpend';
}) {
  return (
    <div className="card customer-stat-card h-100">
      <div className="card-header py-2 small font-weight-bold bg-white">{title}</div>
      <div className="card-body py-2">
        {items.length === 0 ? (
          <p className="small text-muted mb-0">No purchase data yet.</p>
        ) : (
          items.map((p, i) => (
            <div key={p.productName} className="customer-product-rank">
              <div>
                <span className="badge badge-light mr-2">{i + 1}</span>
                <span className="small font-weight-bold">{p.productName}</span>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                  {p.orderCount} bill{p.orderCount !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="text-right small font-weight-bold text-primary">
                {valueKey === 'totalQty' ? `${p.totalQty} units` : formatInr(p.totalSpend)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DashboardContent() {
  const { data, isLoading, isError } = useGetCustomerDashboardQuery();

  if (isLoading) {
    return <PageSpinner message="Loading your dashboard…" />;
  }

  if (isError || !data) {
    return (
      <div className="alert alert-danger m-4">
        Could not load dashboard. Please refresh or sign in again.
      </div>
    );
  }

  const maxMonth = Math.max(...data.monthlySpend.map((m) => m.total), 1);

  return (
    <div className="container py-4 customer-portal-content">
      <div className="mb-4">
        <h1 className="h4 mb-1">Your purchase dashboard</h1>
        <p className="text-muted small mb-0">
          Overview of your shopping at the store — what you buy most and how much you spend.
        </p>
      </div>

      <div className="row mb-4">
        <div className="col-6 col-md-3 mb-3">
          <div className="card customer-stat-card h-100">
            <div className="card-body">
              <p className="text-muted small mb-1">Total spent</p>
              <p className="stat-value mb-0">{formatInr(data.summary.totalSpend)}</p>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3 mb-3">
          <div className="card customer-stat-card h-100">
            <div className="card-body">
              <p className="text-muted small mb-1">Invoices</p>
              <p className="stat-value mb-0">{data.summary.totalBills}</p>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3 mb-3">
          <div className="card customer-stat-card h-100">
            <div className="card-body">
              <p className="text-muted small mb-1">Average bill</p>
              <p className="stat-value mb-0">{formatInr(data.summary.averageBill)}</p>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3 mb-3">
          <div className="card customer-stat-card h-100">
            <div className="card-body">
              <p className="text-muted small mb-1">Last visit</p>
              <p className="stat-value mb-0" style={{ fontSize: '1rem' }}>
                {formatBillDate(data.summary.lastPurchaseAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-md-6 mb-3">
          <ProductRankList
            title="Most bought (quantity)"
            items={data.topByQuantity}
            valueKey="totalQty"
          />
        </div>
        <div className="col-md-6 mb-3">
          <ProductRankList title="Top spend by product" items={data.topBySpend} valueKey="totalSpend" />
        </div>
      </div>

      {data.monthlySpend.length > 0 && (
        <div className="card customer-stat-card mb-4">
          <div className="card-header py-2 small font-weight-bold bg-white">
            Spending by month (last 6 months)
          </div>
          <div className="card-body">
            {data.monthlySpend.map((m) => (
              <div key={m.month} className="mb-3">
                <div className="d-flex justify-content-between small mb-1">
                  <span>{m.label}</span>
                  <span className="font-weight-bold">
                    {formatInr(m.total)} · {m.billCount} bill{m.billCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="customer-month-bar">
                  <div
                    className="customer-month-bar__fill"
                    style={{ width: `${Math.max(4, (m.total / maxMonth) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card customer-stat-card">
        <div className="card-header py-2 d-flex justify-content-between align-items-center bg-white">
          <span className="small font-weight-bold">Recent invoices</span>
          <Link href="/customer/invoices" className="btn btn-sm btn-link">
            View all
          </Link>
        </div>
        <CustomerInvoicesTable bills={data.recentBills} compact />
      </div>
    </div>
  );
}

export default function CustomerDashboardPage() {
  return (
    <CustomerAuthGuard>
      <DashboardContent />
    </CustomerAuthGuard>
  );
}
