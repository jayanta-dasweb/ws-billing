'use client';

import type { InvoiceDetailDto } from '@billing/shared';
import { formatBillDate, formatInr } from './customerFormat';

interface CustomerInvoiceDetailProps {
  detail: InvoiceDetailDto;
  children?: React.ReactNode;
}

export function CustomerInvoiceDetail({ detail, children }: CustomerInvoiceDetailProps) {
  return (
    <div className="customer-invoice-detail">
      <div className="card mb-3">
        <div className="card-body">
          <div className="d-flex flex-wrap justify-content-between align-items-start mb-3">
            <div>
              <h2 className="h5 mb-1">{detail.company.name}</h2>
              {detail.company.address && (
                <p className="small text-muted mb-1" style={{ whiteSpace: 'pre-line' }}>
                  {detail.company.address}
                </p>
              )}
              {detail.company.gstin && (
                <p className="small mb-0">GSTIN: {detail.company.gstin}</p>
              )}
            </div>
            <div className="text-right">
              <p className="mb-0 font-weight-bold">Tax invoice</p>
              <p className="h5 mb-0 text-primary">{detail.invoiceNo}</p>
              <p className="small text-muted mb-0">{formatBillDate(detail.invoiceDate)}</p>
            </div>
          </div>

          <div className="row small mb-3">
            <div className="col-md-6">
              <p className="text-muted mb-1">Billed to</p>
              <p className="font-weight-bold mb-0">{detail.customer.name}</p>
              {detail.customer.mobile && <p className="mb-0">Mobile: {detail.customer.mobile}</p>}
              {detail.customer.gstNumber && (
                <p className="mb-0">GSTIN: {detail.customer.gstNumber}</p>
              )}
              {detail.customer.billingAddress && (
                <p className="mb-0 mt-1" style={{ whiteSpace: 'pre-line' }}>
                  {detail.customer.billingAddress}
                </p>
              )}
            </div>
            <div className="col-md-6 text-md-right mt-2 mt-md-0">
              <p className="text-muted mb-1">Store counter</p>
              <p className="mb-0">{detail.counterName}</p>
              {detail.isCredit && (
                <span className="badge badge-warning mt-1">Credit sale</span>
              )}
            </div>
          </div>

          {children}
        </div>
      </div>

      <div className="card mb-3">
        <div className="table-responsive">
          <table className="table table-sm mb-0">
            <thead className="thead-light">
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>HSN</th>
                <th>Batch</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Disc.</th>
                <th className="text-right">GST%</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((line, idx) => (
                <tr key={`${line.productName}-${idx}`}>
                  <td>{idx + 1}</td>
                  <td>{line.productName}</td>
                  <td>{line.hsnCode ?? '—'}</td>
                  <td>{line.batchNumber ?? '—'}</td>
                  <td className="text-right">{line.qty}</td>
                  <td className="text-right">{formatInr(line.rate)}</td>
                  <td className="text-right">
                    {line.discount > 0 ? formatInr(line.discount) : '—'}
                  </td>
                  <td className="text-right">{line.gstPercent}%</td>
                  <td className="text-right font-weight-bold">{formatInr(line.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="row">
        <div className="col-md-7">
          {detail.taxSummary.length > 0 && (
            <div className="card mb-3">
              <div className="card-header py-2 small font-weight-bold">Tax summary</div>
              <div className="table-responsive">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>GST%</th>
                      <th className="text-right">Taxable</th>
                      <th className="text-right">CGST</th>
                      <th className="text-right">SGST</th>
                      <th className="text-right">IGST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.taxSummary.map((row) => (
                      <tr key={row.gstPercent}>
                        <td>{row.gstPercent}%</td>
                        <td className="text-right">{formatInr(row.taxable)}</td>
                        <td className="text-right">{formatInr(row.cgst)}</td>
                        <td className="text-right">{formatInr(row.sgst)}</td>
                        <td className="text-right">{formatInr(row.igst)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div className="col-md-5">
          <div className="card mb-3">
            <div className="card-body py-3">
              <dl className="row small mb-0">
                <dt className="col-6">Subtotal</dt>
                <dd className="col-6 text-right">{formatInr(detail.subtotal)}</dd>
                {detail.lineDiscountTotal > 0 && (
                  <>
                    <dt className="col-6">Line discount</dt>
                    <dd className="col-6 text-right">−{formatInr(detail.lineDiscountTotal)}</dd>
                  </>
                )}
                {detail.billDiscount > 0 && (
                  <>
                    <dt className="col-6">Bill discount</dt>
                    <dd className="col-6 text-right">−{formatInr(detail.billDiscount)}</dd>
                  </>
                )}
                <dt className="col-6">CGST</dt>
                <dd className="col-6 text-right">{formatInr(detail.cgstTotal)}</dd>
                <dt className="col-6">SGST</dt>
                <dd className="col-6 text-right">{formatInr(detail.sgstTotal)}</dd>
                {detail.igstTotal > 0 && (
                  <>
                    <dt className="col-6">IGST</dt>
                    <dd className="col-6 text-right">{formatInr(detail.igstTotal)}</dd>
                  </>
                )}
                {detail.roundOff !== 0 && (
                  <>
                    <dt className="col-6">Round off</dt>
                    <dd className="col-6 text-right">{formatInr(detail.roundOff)}</dd>
                  </>
                )}
                <dt className="col-6 font-weight-bold">Grand total</dt>
                <dd className="col-6 text-right h5 mb-0 text-primary">
                  {formatInr(detail.grandTotal)}
                </dd>
              </dl>
            </div>
          </div>

          {detail.payments.length > 0 && (
            <div className="card mb-3">
              <div className="card-header py-2 small font-weight-bold">Payment</div>
              <ul className="list-group list-group-flush small">
                {detail.payments.map((p, i) => (
                  <li key={i} className="list-group-item d-flex justify-content-between">
                    <span>{p.mode}</span>
                    <span className="font-weight-bold">{formatInr(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {detail.company.terms && (
        <p className="small text-muted" style={{ whiteSpace: 'pre-line' }}>
          {detail.company.terms}
        </p>
      )}
    </div>
  );
}
