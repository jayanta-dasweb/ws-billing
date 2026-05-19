'use client';

import { useState } from 'react';
import { AutoDismissAlert } from '@/components/ui/AutoDismissAlert';
import { useTimedAlerts } from '@/hooks/useTimedAlerts';
import type { StockAdjustmentReasonDto } from '@billing/shared';
import { NumericInput } from '@/components/masters/NumericInput';
import {
  useCreateAdjustmentMutation,
  useListAdjustmentsQuery,
  useLazyListMovementsQuery,
} from '@/services/api/inventoryApi';
import { getApiErrorMessage } from '@/utils/api';

const REASONS: { value: StockAdjustmentReasonDto; label: string }[] = [
  { value: 'PHYSICAL_COUNT', label: 'Physical count' },
  { value: 'DAMAGE', label: 'Damage' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'THEFT', label: 'Theft' },
  { value: 'CORRECTION', label: 'Correction' },
  { value: 'OTHER', label: 'Other' },
];

export default function StockAdjustmentsPage() {
  const [batchId, setBatchId] = useState('');
  const [qtyDelta, setQtyDelta] = useState(0);
  const [reason, setReason] = useState<StockAdjustmentReasonDto>('PHYSICAL_COUNT');
  const [notes, setNotes] = useState('');
  const { message, error, setMessage, setError } = useTimedAlerts();

  const { data: list, refetch } = useListAdjustmentsQuery({});
  const [createAdj, { isLoading }] = useCreateAdjustmentMutation();
  const [fetchMovements, { data: movements }] = useLazyListMovementsQuery();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const result = await createAdj({ batchId, qtyDelta, reason, notes: notes || undefined }).unwrap();
      setMessage(`Adjustment recorded: ${result.adjNo}`);
      setQtyDelta(0);
      setNotes('');
      void refetch();
      void fetchMovements(batchId);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Adjustment failed'));
    }
  };

  return (
    <>
      <div className="content-header">
        <div className="container-fluid">
          <h1 className="m-0">Stock Adjustments</h1>
          <p className="text-muted small mb-0">Immutable movement log on every change</p>
        </div>
      </div>
      <section className="content">
        <div className="container-fluid">
          <AutoDismissAlert message={message} variant="success" className="mb-2" />
          <AutoDismissAlert message={error} variant="danger" className="mb-2" />

          <div className="row">
            <div className="col-lg-5">
              <div className="card">
                <div className="card-header">New adjustment</div>
                <form className="card-body" onSubmit={(e) => void handleSubmit(e)}>
                  <div className="form-group">
                    <label className="small">Batch ID</label>
                    <input
                      className="form-control"
                      value={batchId}
                      onChange={(e) => setBatchId(e.target.value)}
                      required
                      placeholder="From Batches master"
                    />
                    <small className="text-muted">Copy batch id from Masters → Batches</small>
                  </div>
                  <div className="form-group">
                    <label className="small">Qty change (+ add / − remove)</label>
                    <NumericInput
                      className="form-control"
                      value={qtyDelta}
                      onChange={setQtyDelta}
                    />
                  </div>
                  <div className="form-group">
                    <label className="small">Reason</label>
                    <select
                      className="form-control"
                      value={reason}
                      onChange={(e) => setReason(e.target.value as StockAdjustmentReasonDto)}
                    >
                      {REASONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="small">Notes</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={isLoading || !batchId}>
                    Apply adjustment
                  </button>
                </form>
              </div>
            </div>
            <div className="col-lg-7">
              {movements && movements.length > 0 && (
                <div className="card mb-3">
                  <div className="card-header">Movement history (batch)</div>
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th className="text-right">Δ</th>
                          <th className="text-right">Before</th>
                          <th className="text-right">After</th>
                          <th>When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movements.map((m) => (
                          <tr key={m.id}>
                            <td>{m.movementType}</td>
                            <td className="text-right">{m.qtyDelta}</td>
                            <td className="text-right">{m.qtyBefore}</td>
                            <td className="text-right">{m.qtyAfter}</td>
                            <td className="small">{new Date(m.createdAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="card">
                <div className="card-header">Recent adjustments</div>
                <div className="table-responsive">
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Product</th>
                        <th className="text-right">Δ Qty</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(list?.data ?? []).map((a) => (
                        <tr key={a.id}>
                          <td>{a.adjNo}</td>
                          <td>
                            {a.productName}
                            <small className="d-block text-muted">{a.batchNumber}</small>
                          </td>
                          <td className="text-right">{a.qtyDelta}</td>
                          <td>{a.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
