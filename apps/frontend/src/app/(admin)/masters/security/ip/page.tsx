'use client';

import { useState } from 'react';
import { FormModal } from '@/components/masters/FormModal';
import {
  useCreateCounterIpRuleMutation,
  useListCounterIpRulesQuery,
  useUpdateCounterIpRuleMutation,
} from '@/services/api/securityApi';
import { useListCountersQuery } from '@/services/api/mastersApi';
import { getApiErrorMessage } from '@/utils/api';

export default function CounterIpPage() {
  const { data: counters } = useListCountersQuery({ activeOnly: true, limit: 100 });
  const [counterId, setCounterId] = useState('');
  const selected = counterId || counters?.items[0]?.id || '';
  const { data: rules, isLoading } = useListCounterIpRulesQuery(selected, { skip: !selected });
  const [createRule, { isLoading: creating }] = useCreateCounterIpRuleMutation();
  const [updateRule, { isLoading: updating }] = useUpdateCounterIpRuleMutation();
  const [modal, setModal] = useState(false);
  const [cidr, setCidr] = useState('');
  const [label, setLabel] = useState('');

  const [actionError, setActionError] = useState('');

  const save = async () => {
    if (!selected || !cidr.trim()) return;
    setActionError('');
    try {
      await createRule({
        counterId: selected,
        cidr: cidr.trim(),
        label: label || undefined,
      }).unwrap();
      setModal(false);
      setCidr('');
      setLabel('');
    } catch (e) {
      setActionError(getApiErrorMessage(e, 'Failed to add IP rule'));
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    setActionError('');
    try {
      await updateRule({ id, counterId: selected, body: { isActive: !isActive } }).unwrap();
    } catch (e) {
      setActionError(getApiErrorMessage(e, 'Failed to update rule'));
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title mb-0">Counter IP allowlist</h3>
      </div>
      <div className="card-body">
        <div className="form-row mb-3">
          <div className="col-md-6">
            <label>Counter</label>
            <select
              className="form-control"
              value={selected}
              onChange={(e) => setCounterId(e.target.value)}
            >
              {counters?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-6 d-flex align-items-end">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!selected}
              onClick={() => setModal(true)}
            >
              <i className="fas fa-plus mr-1" /> Add IP / CIDR
            </button>
          </div>
        </div>
        <p className="text-muted small">
          Empty allowlist = any IP allowed for that counter. Set{' '}
          <code>IP_ALLOWLIST_ENFORCED=true</code> on the server to enforce at cashier login.
        </p>
        {actionError && <div className="alert alert-danger py-2 small">{actionError}</div>}
        {isLoading && <p>Loading rules…</p>}
        <table className="table table-striped table-sm">
          <thead>
            <tr>
              <th>CIDR / IP</th>
              <th>Label</th>
              <th>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rules?.map((r) => (
              <tr key={r.id}>
                <td>
                  <code>{r.cidr}</code>
                </td>
                <td>{r.label || '—'}</td>
                <td>{r.isActive ? 'Yes' : 'No'}</td>
                <td className="text-right">
                  <button
                    type="button"
                    className="btn btn-xs btn-outline-secondary"
                    onClick={() => toggleActive(r.id, r.isActive)}
                  >
                    Toggle
                  </button>
                </td>
              </tr>
            ))}
            {!rules?.length && !isLoading && (
              <tr>
                <td colSpan={4} className="text-muted text-center">
                  No rules — all IPs allowed for this counter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <FormModal
        show={modal}
        title="Add IP rule"
        onClose={() => setModal(false)}
        onSubmit={save}
        saving={creating || updating}
      >
        <div className="form-group">
          <label>CIDR or IP *</label>
          <input
            className="form-control"
            placeholder="192.168.1.10 or 192.168.1.0/24"
            value={cidr}
            onChange={(e) => setCidr(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Label</label>
          <input className="form-control" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
      </FormModal>
    </div>
  );
}
