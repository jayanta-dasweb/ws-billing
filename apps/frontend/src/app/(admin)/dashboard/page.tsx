'use client';

import Link from 'next/link';
import { useSelector } from 'react-redux';
import { useGetHealthQuery } from '@/services/api/healthApi';
import { useGetDaySummaryQuery } from '@/services/api/reportsApi';
import type { RootState } from '@/redux/store';
import { StaffHomeDashboard } from '@/components/admin/StaffHomeDashboard';
import { hasNonCounterAccess } from '@/utils/permissions';
import { getEffectiveRole, getRoleLabel, isAdminUser } from '@/utils/roles';

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
}

export default function DashboardPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const { data: health, isLoading: healthLoading, error: healthError } = useGetHealthQuery();
  const { data: summary, isLoading: summaryLoading, error: summaryError } = useGetDaySummaryQuery();

  if (user && !isAdminUser(user) && hasNonCounterAccess(user)) {
    return <StaffHomeDashboard user={user} />;
  }

  return (
    <>
      <header className="content-header">
        <div className="container-fluid">
          <h1 className="m-0">Admin Dashboard</h1>
          <p className="text-muted mb-0">
            {user?.username} · {user ? user.roleName || getRoleLabel(getEffectiveRole(user)) : ''}
          </p>
        </div>
      </header>

      <section className="row">
        <article className="col-lg-3 col-md-6 mb-3">
          <div className="small-box bg-success">
            <div className="inner">
              <h3>{summaryLoading ? '…' : formatMoney(summary?.sales.grossTotal ?? 0)}</h3>
              <p>Today&apos;s sales ({summary?.sales.billCount ?? 0} bills)</p>
            </div>
            <Link href="/billing" className="small-box-footer">
              Counter <i className="fas fa-arrow-circle-right" />
            </Link>
          </div>
        </article>
        <article className="col-lg-3 col-md-6 mb-3">
          <div className="small-box bg-warning">
            <div className="inner">
              <h3>{summaryLoading ? '…' : formatMoney(summary?.returns.refundTotal ?? 0)}</h3>
              <p>Returns today ({summary?.returns.count ?? 0})</p>
            </div>
            <Link href="/inventory/returns" className="small-box-footer">
              Returns <i className="fas fa-arrow-circle-right" />
            </Link>
          </div>
        </article>
        <article className="col-lg-3 col-md-6 mb-3">
          <div className="small-box bg-info">
            <div className="inner">
              <h3>{summaryLoading ? '…' : formatMoney(summary?.netSales ?? 0)}</h3>
              <p>Net sales today</p>
            </div>
            <span className="small-box-footer text-white-50">Sales − refunds</span>
          </div>
        </article>
        <article className="col-lg-3 col-md-6 mb-3">
          <div className="small-box bg-secondary">
            <div className="inner">
              <h3>{summaryLoading ? '…' : summary?.openBills ?? 0}</h3>
              <p>Open draft / held bills</p>
            </div>
            <span className="small-box-footer text-white-50">
              {summary?.adjustmentsToday ?? 0} stock adjustments today
            </span>
          </div>
        </article>
      </section>

      {summaryError && (
        <p className="alert alert-warning">
          Day summary unavailable — re-run seed if you upgraded permissions (
          <code>reports.day.view</code>).
        </p>
      )}

      {summary && summary.byCounter.length > 0 && (
        <section className="card mb-3">
          <header className="card-header">
            <h3 className="card-title mb-0">Today by counter</h3>
          </header>
          <div className="card-body p-0">
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th>Counter</th>
                  <th className="text-right">Bills</th>
                  <th className="text-right">Gross</th>
                </tr>
              </thead>
              <tbody>
                {summary.byCounter.map((row) => (
                  <tr key={row.counterId ?? 'none'}>
                    <td>{row.counterName}</td>
                    <td className="text-right">{row.billCount}</td>
                    <td className="text-right">{formatMoney(row.grossTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="row">
        <article className="col-lg-3 col-md-6 mb-3">
          <div className="small-box bg-primary">
            <div className="inner">
              <h3>Masters</h3>
              <p>Company, products, tax, counters</p>
            </div>
            <Link href="/masters/company" className="small-box-footer">
              Manage <i className="fas fa-arrow-circle-right" />
            </Link>
          </div>
        </article>
        <article className="col-lg-3 col-md-6 mb-3">
          <div className="small-box bg-info">
            <div className="inner">
              <h3>Users</h3>
              <p>Staff accounts</p>
            </div>
            <Link href="/masters/users" className="small-box-footer">
              Open <i className="fas fa-arrow-circle-right" />
            </Link>
          </div>
        </article>
        <article className="col-lg-3 col-md-6 mb-3">
          <div className="small-box bg-secondary">
            <div className="inner">
              <h3>Roles</h3>
              <p>Permissions (RBAC)</p>
            </div>
            <Link href="/masters/roles" className="small-box-footer">
              Configure <i className="fas fa-arrow-circle-right" />
            </Link>
          </div>
        </article>
        <article className="col-lg-3 col-md-6 mb-3">
          <div className="small-box bg-teal">
            <div className="inner">
              <h3>Inventory</h3>
              <p>Returns, adjustments, audit</p>
            </div>
            <Link href="/inventory/returns" className="small-box-footer">
              Open <i className="fas fa-arrow-circle-right" />
            </Link>
          </div>
        </article>
      </section>

      <section className="row">
        <article className="col-lg-4 mb-3">
          <section className="card">
            <header className="card-header">
              <h3 className="card-title">System health</h3>
            </header>
            <div className="card-body">
              {healthLoading && <p>Checking services…</p>}
              {healthError && <p className="text-danger mb-0">API unreachable.</p>}
              {health && (
                <ul className="list-unstyled small mb-0">
                  <li>
                    API: <span className="text-success">{health.status}</span>
                  </li>
                  <li>Database: {String(health.services?.database ?? '—')}</li>
                  <li>Redis: {String(health.services?.redis ?? '—')}</li>
                </ul>
              )}
            </div>
          </section>
        </article>
      </section>

      <p className="alert alert-info mb-0">
        Cashiers go straight to billing. Audit Trail is under Security in the left menu.
      </p>
    </>
  );
}
