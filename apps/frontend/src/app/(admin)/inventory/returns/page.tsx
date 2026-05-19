'use client';

import { useState } from 'react';
import { AutoDismissAlert } from '@/components/ui/AutoDismissAlert';
import { useTimedAlerts } from '@/hooks/useTimedAlerts';
import type { ReturnTypeDto, ReturnableBillDto } from '@billing/shared';
import { PageSpinner } from '@/components/loading/PageSpinner';
import { NumericInput } from '@/components/masters/NumericInput';
import {
  useCompleteReturnMutation,
  useCreateReturnMutation,
  useLazyLookupReturnBillQuery,
  useListReturnsQuery,
} from '@/services/api/returnsApi';
import { getApiErrorMessage } from '@/utils/api';

export default function ReturnsPage() {
  const [invoiceNo, setInvoiceNo] = useState('');
  const [lookup, { isFetching }] = useLazyLookupReturnBillQuery();
  const [bill, setBill] = useState<ReturnableBillDto | null>(null);
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const { message, error, setMessage, setError } = useTimedAlerts();

  const { data: history = [], refetch } = useListReturnsQuery();
  const [createReturn, { isLoading: creating }] = useCreateReturnMutation();
  const [completeReturn, { isLoading: completing }] = useCompleteReturnMutation();

  const handleLookup = async () => {
    setError('');
    setMessage('');
    try {
      const result = await lookup({ invoiceNo: invoiceNo.trim() }).unwrap();
      setBill(result);
      const qty: Record<string, number> = {};
      for (const item of result.items) {
        qty[item.id] = item.returnableQty;
      }
      setReturnQty(qty);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Invoice not found'));
    }
  };

  const handleSubmit = async (returnType: ReturnTypeDto) => {
    if (!bill) return;
    setError('');
    try {
      const lines = bill.items
        .filter((i) => (returnQty[i.id] ?? 0) > 0)
        .map((i) => ({ billItemId: i.id, qty: returnQty[i.id] ?? 0 }));
      if (!lines.length) {
        setError('Select at least one line to return');
        return;
      }
      const draft = await createReturn({
        billId: bill.billId,
        returnType,
        lines,
      }).unwrap();
      const done = await completeReturn({ id: draft.id }).unwrap();
      setMessage(`Return completed: ${done.returnNo} · refund ₹${done.refundTotal.toFixed(2)}`);
      setBill(null);
      setInvoiceNo('');
      void refetch();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Return failed'));
    }
  };

  if (isFetching) return <PageSpinner message="Loading invoice…" fullScreen={false} />;

  return (
  <>
      <div className="content-header">
        <div className="container-fluid">
          <h1 className="m-0">Sales Returns</h1>
          <p className="text-muted small mb-0">Full or partial return against completed invoices</p>
        </div>
      </div>
      <section className="content">
        <div className="container-fluid">
          <AutoDismissAlert message={message} variant="success" className="mb-2" />
          <AutoDismissAlert message={error} variant="danger" className="mb-2" />

          <div className="card mb-3">
            <div className="card-header">Lookup invoice</div>
            <div className="card-body">
              <div className="form-row align-items-end">
                <div className="col-md-6">
                  <label className="small">Invoice number</label>
                  <input
                    className="form-control"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    placeholder="INV/2026/00001"
                  />
                </div>
                <div className="col-md-3">
                  <button type="button" className="btn btn-primary btn-block" onClick={() => void handleLookup()}>
                    Load
                  </button>
                </div>
              </div>
            </div>
          </div>

          {bill && (
            <div className="card mb-3">
              <div className="card-header">
                {bill.invoiceNo} · {bill.customerName ?? 'Walk-in'} · ₹{bill.grandTotal.toFixed(2)}
              </div>
              <div className="table-responsive">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="text-right">Sold</th>
                      <th className="text-right">Returnable</th>
                      <th className="text-right">Return qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {item.productName}
                          {item.batchNumber && (
                            <small className="d-block text-muted">{item.batchNumber}</small>
                          )}
                        </td>
                        <td className="text-right">{item.soldQty}</td>
                        <td className="text-right">{item.returnableQty}</td>
                        <td className="text-right" style={{ width: 100 }}>
                          <NumericInput
                            className="form-control form-control-sm text-right"
                            value={returnQty[item.id] ?? 0}
                            onChange={(v) => setReturnQty((q) => ({ ...q, [item.id]: v }))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card-footer">
                <button
                  type="button"
                  className="btn btn-warning mr-2"
                  disabled={creating || completing}
                  onClick={() => void handleSubmit('PARTIAL')}
                >
                  Complete partial return
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={creating || completing}
                  onClick={() => void handleSubmit('FULL')}
                >
                  Complete full return
                </button>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">Recent returns</div>
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead>
                  <tr>
                    <th>Return #</th>
                    <th>Invoice</th>
                    <th>Status</th>
                    <th className="text-right">Refund</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r) => (
                    <tr key={r.id}>
                      <td>{r.returnNo ?? r.id.slice(0, 8)}</td>
                      <td>{r.invoiceNo ?? '—'}</td>
                      <td>
                        <span className={`badge badge-${r.status === 'COMPLETED' ? 'success' : 'secondary'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="text-right">₹{r.refundTotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
  </>
  );
}
