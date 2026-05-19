import type { InvoiceDetailDto } from '@billing/shared';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(n: number): string {
  return n.toFixed(2);
}

export function buildInvoicePrintHtml(detail: InvoiceDetailDto, thermal = false): string {
  const rows = detail.items
    .map(
      (i) =>
        `<tr>
          <td>${esc(i.productName)}${i.batchNumber ? `<br><small>${esc(i.batchNumber)}</small>` : ''}</td>
          <td class="num">${i.qty}</td>
          <td class="num">${fmt(i.rate)}</td>
          <td class="num">${fmt(i.lineTotal)}</td>
        </tr>`,
    )
    .join('');

  const payLines = detail.payments
    .map(
      (p) =>
        `<p class="pay-line">${esc(p.mode)}: ₹${fmt(p.amount)}${p.reference ? ` — ${esc(p.reference)}` : ''}</p>`,
    )
    .join('');

  const width = thermal ? '80mm' : '210mm';
  const discLine =
    detail.lineDiscountTotal > 0
      ? `<p>Line disc.: −₹${fmt(detail.lineDiscountTotal)}</p>`
      : '';
  const billDiscLine =
    detail.billDiscount > 0 ? `<p>Bill disc.: −₹${fmt(detail.billDiscount)}</p>` : '';
  const roundLine =
    detail.roundOff !== 0
      ? `<p>Round off: ${detail.roundOff >= 0 ? '+' : ''}${fmt(detail.roundOff)}</p>`
      : '';
  const gstLine = detail.company.gstin ? `<br/>GSTIN: ${esc(detail.company.gstin)}` : '';
  const custMobile = detail.customer.mobile ? ` · ${esc(detail.customer.mobile)}` : '';
  const custGst = detail.customer.gstNumber
    ? `<br/>Customer GSTIN: ${esc(detail.customer.gstNumber)}`
    : '';
  const payBlock = payLines
    ? `<section class="pay"><strong>Payment</strong>${payLines}</section>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${esc(detail.invoiceNo)}</title>
<style>
  @page { margin: ${thermal ? '4mm' : '12mm'}; size: ${thermal ? '80mm auto' : 'A4'}; }
  body { font-family: Arial, sans-serif; font-size: ${thermal ? '11px' : '12px'}; color: #111; margin: 0; padding: 8px; max-width: ${width}; }
  h1 { font-size: ${thermal ? '14px' : '18px'}; margin: 0 0 4px; }
  .meta { font-size: 11px; color: #333; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #333; padding: 4px 6px; text-align: left; }
  th { background: #f0f0f0; }
  .num { text-align: right; }
  .totals { margin-top: 10px; text-align: right; font-size: 13px; }
  .totals p { margin: 2px 0; }
  .grand { font-size: 16px; font-weight: bold; }
  .pay { margin-top: 8px; font-size: 11px; }
  .pay-line { margin: 2px 0; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <h1>${esc(detail.company.name)}</h1>
  <p class="meta">
    ${esc(detail.company.address)}${gstLine}<br/>
    <strong>TAX INVOICE ${esc(detail.invoiceNo)}</strong><br/>
    Date: ${new Date(detail.invoiceDate).toLocaleString('en-IN')} · ${esc(detail.counterName)}
  </p>
  <p class="meta">
    <strong>To:</strong> ${esc(detail.customer.name)}${custMobile}${custGst}
  </p>
  <table>
    <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <section class="totals">
    <p>Subtotal: ₹${fmt(detail.subtotal)}</p>
    ${discLine}
    ${billDiscLine}
    ${roundLine}
    <p class="grand">Grand total: ₹${fmt(detail.grandTotal)}</p>
  </section>
  ${payBlock}
  <p class="no-print" style="margin-top:16px;text-align:center;">
    <button type="button" onclick="window.print()">Print again</button>
    <button type="button" onclick="window.close()">Close</button>
  </p>
  <script>window.onload = function () { window.focus(); window.print(); };</script>
</body>
</html>`;
}

export function openInvoicePrintWindow(detail: InvoiceDetailDto, thermal = false): void {
  const w = window.open('', '_blank', 'noopener,noreferrer,width=800,height=900');
  if (!w) {
    throw new Error('Pop-up blocked — allow pop-ups to print');
  }
  w.document.write(buildInvoicePrintHtml(detail, thermal));
  w.document.close();
}
