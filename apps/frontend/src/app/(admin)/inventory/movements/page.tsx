'use client';

import { useState } from 'react';
import { AutoDismissAlert } from '@/components/ui/AutoDismissAlert';
import { useTimedAlerts } from '@/hooks/useTimedAlerts';
import { useLazyListMovementsQuery } from '@/services/api/inventoryApi';
import { getApiErrorMessage } from '@/utils/api';

export default function StockMovementsPage() {
  const [batchId, setBatchId] = useState('');
  const { error, setError } = useTimedAlerts();
  const [fetchMovements, { data: movements, isFetching }] = useLazyListMovementsQuery();

  const handleLoad = async () => {
    setError('');
    const id = batchId.trim();
    if (!id) {
      setError('Enter a batch ID from Master → Batches');
      return;
    }
    try {
      await fetchMovements(id).unwrap();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not load movements'));
    }
  };

  return (
    <>
      <div className="content-header">
        <div className="container-fluid">
          <h1 className="m-0">Stock Movement History</h1>
          <p className="text-muted small mb-0">Sales, returns, adjustments — full ledger per batch</p>
        </div>
      </div>
      <section className="content">
        <div className="container-fluid">
          <div className="card mb-3">
            <div className="card-body">
              <div className="form-row align-items-end">
                <div className="col-md-8">
                  <label>Batch ID</label>
                  <input
                    className="form-control"
                    placeholder="Paste batch cuid from Batches master"
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    disabled={isFetching}
                    onClick={() => void handleLoad()}
                  >
                    {isFetching ? 'Loading…' : 'Load history'}
                  </button>
                </div>
              </div>
              <AutoDismissAlert message={error} variant="danger" className="mt-2 mb-0" />
            </div>
          </div>
          {movements && (
            <div className="card">
              <div className="card-body table-responsive p-0">
                <table className="table table-sm table-striped mb-0">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Type</th>
                      <th>Δ Qty</th>
                      <th>Before</th>
                      <th>After</th>
                      <th>Reference</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id}>
                        <td className="small text-nowrap">
                          {new Date(m.createdAt).toLocaleString()}
                        </td>
                        <td>
                          <code className="small">{m.movementType}</code>
                        </td>
                        <td className={m.qtyDelta >= 0 ? 'text-success' : 'text-danger'}>
                          {m.qtyDelta >= 0 ? '+' : ''}
                          {m.qtyDelta}
                        </td>
                        <td>{m.qtyBefore}</td>
                        <td>{m.qtyAfter}</td>
                        <td className="small">
                          {m.referenceType}
                          <br />
                          <span className="text-muted">{m.referenceId}</span>
                        </td>
                        <td className="small">{m.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {movements.length === 0 && (
                  <p className="p-3 text-muted mb-0">No movements for this batch.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
