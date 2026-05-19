'use client';

import { useMemo, useState } from 'react';
import {
  AUDIT_SEVERITY_COLORS,
  AuditSeverity,
  AuditSource,
  type ActivityLogDto,
} from '@billing/shared';
import { useSelector } from 'react-redux';
import type { RootState } from '@/redux/store';
import {
  downloadAuditCsv,
  useGetActivityLogQuery,
  useGetAuditFilterMetaQuery,
  useListActivityLogsQuery,
} from '@/services/api/auditApi';
import { getApiErrorMessage } from '@/utils/api';

function severityBadge(sev: AuditSeverity) {
  const c = AUDIT_SEVERITY_COLORS[sev] ?? AUDIT_SEVERITY_COLORS[AuditSeverity.INFO];
  return <span className={`badge badge-${c.badge}`}>{c.label}</span>;
}

function rowClass(sev: AuditSeverity, success: boolean) {
  if (!success) return 'audit-row--warning';
  const c = AUDIT_SEVERITY_COLORS[sev];
  return c?.row ?? '';
}

function JsonBlock({ data }: { data: unknown }) {
  if (data == null) return <span className="text-muted">—</span>;
  return (
    <pre className="audit-json mb-0">{JSON.stringify(data, null, 2)}</pre>
  );
}

function DetailDrawer({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useGetActivityLogQuery(id!, { skip: !id });

  if (!id) return null;

  return (
    <div className="audit-drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="audit-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Activity detail"
      >
        <header className="audit-drawer__head">
          <h2 className="h5 mb-0">Activity detail</h2>
          <button type="button" className="close" onClick={onClose} aria-label="Close">
            <span>&times;</span>
          </button>
        </header>
        <div className="audit-drawer__body">
          {isLoading && <p>Loading…</p>}
          {data && (
            <>
              <p className="mb-2">
                {severityBadge(data.severity)}
                {!data.success && (
                  <span className="badge badge-warning ml-1">Failed</span>
                )}
                <span className="badge badge-secondary ml-1">{data.source}</span>
              </p>
              <p className="small text-muted mb-3">
                {new Date(data.createdAt).toLocaleString()} · {data.module}
              </p>
              <h3 className="h6">{data.description ?? data.action}</h3>
              <dl className="audit-dl small">
                <dt>Action</dt>
                <dd>
                  <code>{data.action}</code>
                </dd>
                <dt>User</dt>
                <dd>
                  {data.username ?? '—'}
                  {data.roleKey ? ` (${data.roleKey})` : ''}
                </dd>
                <dt>Subject</dt>
                <dd>
                  {data.subjectType}
                  {data.subjectId ? ` · ${data.subjectId}` : ''}
                </dd>
                <dt>Reference</dt>
                <dd>
                  {data.referenceType
                    ? `${data.referenceType} ${data.referenceId ?? ''}`
                    : '—'}
                </dd>
                <dt>Counter</dt>
                <dd>{data.counterId ?? '—'}</dd>
                <dt>IP</dt>
                <dd>{data.ipAddress ?? '—'}</dd>
                <dt>Source</dt>
                <dd>{data.requestSource ?? '—'}</dd>
                {data.reason && (
                  <>
                    <dt>Reason</dt>
                    <dd>{data.reason}</dd>
                  </>
                )}
              </dl>
              <h4 className="h6 mt-3">Before</h4>
              <JsonBlock data={data.beforeData} />
              <h4 className="h6 mt-3">After</h4>
              <JsonBlock data={data.afterData} />
              <h4 className="h6 mt-3">Properties</h4>
              <JsonBlock data={data.properties} />
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

export function ActivityLogPage() {
  const accessToken = useSelector((s: RootState) => s.auth.accessToken);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');
  const [severity, setSeverity] = useState<AuditSeverity | ''>('');
  const [source, setSource] = useState<AuditSource | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [subjectType, setSubjectType] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      page,
      limit: 50,
      search: search.trim() || undefined,
      module: module || undefined,
      action: action || undefined,
      severity: severity || undefined,
      source: source || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      subjectType: subjectType.trim() || undefined,
      subjectId: subjectId.trim() || undefined,
    }),
    [page, search, module, action, severity, source, dateFrom, dateTo, subjectType, subjectId],
  );

  const { data, isLoading, error, refetch } = useListActivityLogsQuery(filters);
  const { data: meta } = useGetAuditFilterMetaQuery();

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const handleExport = async () => {
    try {
      await downloadAuditCsv(filters, accessToken);
    } catch (e) {
      alert(getApiErrorMessage(e, 'Export failed'));
    }
  };

  return (
    <>
      <header className="content-header">
        <div className="container-fluid d-flex flex-wrap align-items-center justify-content-between">
          <div>
            <h1 className="m-0">Audit Trail</h1>
            <p className="text-muted small mb-0">
              Immutable activity log (Spatie-style) — who, what, when, before/after. Cannot be edited
              or deleted.
            </p>
          </div>
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => void handleExport()}>
            <i className="fas fa-download mr-1" /> Export CSV
          </button>
        </div>
      </header>

      <section className="content">
        <div className="container-fluid">
          <div className="card card-outline card-secondary">
            <div className="card-header">
              <h3 className="card-title mb-0">Filters</h3>
              <div className="card-tools">
                <button type="button" className="btn btn-tool" onClick={() => void refetch()}>
                  <i className="fas fa-sync-alt" />
                </button>
              </div>
            </div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group col-md-3">
                  <label className="small">Search</label>
                  <input
                    className="form-control form-control-sm"
                    placeholder="Action, user, ID, reason…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <div className="form-group col-md-2">
                  <label className="small">Module</label>
                  <select
                    className="form-control form-control-sm"
                    value={module}
                    onChange={(e) => {
                      setModule(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All</option>
                    {(meta?.modules ?? []).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group col-md-2">
                  <label className="small">Severity</label>
                  <select
                    className="form-control form-control-sm"
                    value={severity}
                    onChange={(e) => {
                      setSeverity(e.target.value as AuditSeverity | '');
                      setPage(1);
                    }}
                  >
                    <option value="">All</option>
                    {Object.values(AuditSeverity).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group col-md-2">
                  <label className="small">Source</label>
                  <select
                    className="form-control form-control-sm"
                    value={source}
                    onChange={(e) => {
                      setSource(e.target.value as AuditSource | '');
                      setPage(1);
                    }}
                  >
                    <option value="">All</option>
                    {Object.values(AuditSource).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group col-md-3">
                  <label className="small">Action contains</label>
                  <input
                    className="form-control form-control-sm"
                    list="audit-actions"
                    value={action}
                    onChange={(e) => {
                      setAction(e.target.value);
                      setPage(1);
                    }}
                  />
                  <datalist id="audit-actions">
                    {(meta?.actions ?? []).map((a) => (
                      <option key={a} value={a} />
                    ))}
                  </datalist>
                </div>
                <div className="form-group col-md-2">
                  <label className="small">From date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <div className="form-group col-md-2">
                  <label className="small">To date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <div className="form-group col-md-2">
                  <label className="small">Subject type</label>
                  <input
                    className="form-control form-control-sm"
                    placeholder="Bill, User…"
                    value={subjectType}
                    onChange={(e) => {
                      setSubjectType(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <div className="form-group col-md-3">
                  <label className="small">Subject / reference ID</label>
                  <input
                    className="form-control form-control-sm"
                    value={subjectId}
                    onChange={(e) => {
                      setSubjectId(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
              <div className="d-flex flex-wrap small mb-2">
                <span className="mr-3">
                  <span className="audit-legend audit-legend--info" /> Info
                </span>
                <span className="mr-3">
                  <span className="audit-legend audit-legend--warning" /> Warning
                </span>
                <span className="mr-3">
                  <span className="audit-legend audit-legend--critical" /> Critical
                </span>
                <span>
                  <span className="audit-legend audit-legend--security" /> Security
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body p-0">
              {error && (
                <p className="text-danger p-3 mb-0">{getApiErrorMessage(error, 'Failed to load')}</p>
              )}
              {isLoading && <p className="p-3 mb-0">Loading activity log…</p>}
              <div className="table-responsive">
                <table className="table table-sm table-hover mb-0 audit-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Severity</th>
                      <th>Module</th>
                      <th>Action</th>
                      <th>Description</th>
                      <th>User</th>
                      <th>Counter</th>
                      <th>IP</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data?.data.map((row: ActivityLogDto) => (
                      <tr
                        key={row.id}
                        className={rowClass(row.severity, row.success)}
                        onClick={() => setSelectedId(row.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="text-nowrap small">
                          {new Date(row.createdAt).toLocaleString()}
                        </td>
                        <td>{severityBadge(row.severity)}</td>
                        <td className="small">{row.module}</td>
                        <td>
                          <code className="small">{row.action}</code>
                        </td>
                        <td className="small text-truncate" style={{ maxWidth: 220 }}>
                          {row.description ?? '—'}
                        </td>
                        <td className="small">{row.username ?? '—'}</td>
                        <td className="small">{row.counterId?.slice(0, 8) ?? '—'}</td>
                        <td className="small">{row.ipAddress ?? '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-xs btn-outline-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(row.id);
                            }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data && data.data.length === 0 && !isLoading && (
                <p className="text-muted p-3 mb-0">No activity matches your filters.</p>
              )}
            </div>
            {data && totalPages > 1 && (
              <div className="card-footer d-flex justify-content-between align-items-center">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span className="small text-muted">
                  Page {page} of {totalPages} ({data.total} events)
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <DetailDrawer id={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
