import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');
import type { InvoiceDetailDto, InvoicePrintFormat } from '@billing/shared';
import {
  INV,
  amountInWords,
  drawAccentBar,
  drawSoftCard,
  formatInvoiceDate,
  formatRs,
  paymentLabel,
  taxableAmount,
} from './invoice-pdf-modern.util';

const PDF_CACHE_VER = 'v3';

@Injectable()
export class InvoicePdfService {
  private readonly storageDir: string;

  constructor(config: ConfigService) {
    this.storageDir = path.resolve(
      config.get<string>('INVOICE_STORAGE_PATH', 'storage/invoices'),
    );
    fs.mkdirSync(this.storageDir, { recursive: true });
  }

  getPdfPath(invoiceId: string, format: InvoicePrintFormat = 'a4'): string {
    const suffix = format === 'thermal' ? `-thermal-${PDF_CACHE_VER}` : `-a4-${PDF_CACHE_VER}`;
    return path.join(this.storageDir, `${invoiceId}${suffix}.pdf`);
  }

  async generate(
    detail: InvoiceDetailDto,
    invoiceId: string,
    format: InvoicePrintFormat = 'a4',
  ): Promise<string> {
    const filePath = this.getPdfPath(invoiceId, format);
    if (format === 'thermal') {
      await this.writeModernThermalPdf(detail, filePath);
    } else {
      await this.writeModernA4Pdf(detail, filePath);
    }
    return filePath;
  }

  readIfExists(invoiceId: string, format: InvoicePrintFormat = 'a4'): Buffer | null {
    const filePath = this.getPdfPath(invoiceId, format);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
  }

  private writeModernA4Pdf(detail: InvoiceDetailDto, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const left = 36;
      const pageW = doc.page.width - 72;
      let y = 36;

      drawAccentBar(doc, left, y, pageW, 4);
      y += 16;

      doc.fillColor(INV.ink).font('Helvetica-Bold').fontSize(20);
      doc.text(detail.company.name, left, y, { width: pageW * 0.62 });
      const badgeW = 118;
      const badgeX = left + pageW - badgeW;
      doc.save();
      doc.roundedRect(badgeX, y - 2, badgeW, 36, 8).fill(INV.accent);
      doc.fillColor(INV.white).fontSize(9).font('Helvetica-Bold');
      doc.text('TAX INVOICE', badgeX, y + 4, { width: badgeW, align: 'center' });
      doc.font('Helvetica').fontSize(8);
      doc.text(detail.invoiceNo, badgeX, y + 18, { width: badgeW, align: 'center' });
      doc.restore();

      y += 28;
      doc.fillColor(INV.muted).font('Helvetica').fontSize(8.5);
      const addrLines = [detail.company.address];
      if (detail.company.gstin) addrLines.push(`GSTIN ${detail.company.gstin}`);
      if (detail.company.phone) addrLines.push(`Tel ${detail.company.phone}`);
      if (detail.company.email) addrLines.push(detail.company.email);
      doc.text(addrLines.filter(Boolean).join('  ·  '), left, y, { width: pageW * 0.7 });
      doc.text(formatInvoiceDate(detail.invoiceDate), left + pageW - 90, y, {
        width: 90,
        align: 'right',
      });
      y += 22;

      doc.strokeColor(INV.line).lineWidth(0.5);
      doc.moveTo(left, y).lineTo(left + pageW, y).stroke();
      y += 14;

      const half = (pageW - 12) / 2;
      drawSoftCard(doc, left, y, half, 52);
      drawSoftCard(doc, left + half + 12, y, half, 52);

      doc.fillColor(INV.muted).font('Helvetica-Bold').fontSize(7);
      doc.text('BILL TO', left + 10, y + 8);
      doc.text('SALE INFO', left + half + 22, y + 8);

      doc.fillColor(INV.ink).font('Helvetica-Bold').fontSize(10);
      doc.text(detail.customer.name, left + 10, y + 20, { width: half - 20 });
      doc.font('Helvetica').fontSize(8.5).fillColor(INV.muted);
      const custMeta: string[] = [];
      if (detail.customer.mobile) custMeta.push(detail.customer.mobile);
      if (detail.customer.gstNumber) custMeta.push(`GSTIN ${detail.customer.gstNumber}`);
      if (detail.customer.billingAddress) custMeta.push(detail.customer.billingAddress);
      doc.text(custMeta.join('\n') || '—', left + 10, y + 34, { width: half - 20 });

      doc.fillColor(INV.ink).font('Helvetica').fontSize(8.5);
      doc.text(`Counter  ${detail.counterName}`, left + half + 22, y + 20, { width: half - 24 });
      if (detail.isCredit) {
        doc.fillColor(INV.warn).font('Helvetica-Bold').fontSize(8);
        doc.text('Credit sale', left + half + 22, y + 34);
      }

      y += 64;

      const cols = [22, pageW - 22 - 44 - 52 - 62, 44, 52, 62];
      const headers = ['#', 'Item', 'Qty', 'Rate', 'Amount'];

      doc.save();
      doc.roundedRect(left, y, pageW, 20, 4).fill(INV.ink);
      doc.fillColor(INV.white).font('Helvetica-Bold').fontSize(8);
      let hx = left;
      headers.forEach((h, i) => {
        doc.text(h, hx + 6, y + 6, {
          width: cols[i] - 10,
          align: i >= 2 ? 'right' : 'left',
        });
        hx += cols[i];
      });
      doc.restore();
      y += 22;

      doc.font('Helvetica').fontSize(8.5);
      detail.items.forEach((item, idx) => {
        if (y > 700) {
          doc.addPage();
          y = 48;
        }
        if (idx % 2 === 0) {
          doc.save();
          doc.rect(left, y - 1, pageW, 28).fill('#fafbfc');
          doc.restore();
        }

        const gstNote =
          item.gstPercent > 0
            ? `GST ${item.gstPercent}% · ${formatRs(item.cgstAmount + item.sgstAmount + item.igstAmount)}`
            : '';

        let cx = left;
        doc.fillColor(INV.muted).text(String(idx + 1), cx + 6, y + 4, { width: cols[0] - 8 });
        cx += cols[0];

        doc.fillColor(INV.ink).font('Helvetica-Bold').fontSize(8.5);
        doc.text(item.productName, cx + 4, y + 3, { width: cols[1] - 8 });
        doc.font('Helvetica').fontSize(7).fillColor(INV.muted);
        const sub = [item.batchNumber && `Batch ${item.batchNumber}`, item.hsnCode && `HSN ${item.hsnCode}`, gstNote]
          .filter(Boolean)
          .join('  ·  ');
        if (sub) doc.text(sub, cx + 4, y + 14, { width: cols[1] - 8 });
        cx += cols[1];

        doc.fillColor(INV.ink).fontSize(8.5);
        doc.text(item.qty.toFixed(2), cx + 4, y + 6, { width: cols[2] - 8, align: 'right' });
        cx += cols[2];
        doc.text(formatRs(item.rate), cx + 4, y + 6, { width: cols[3] - 8, align: 'right' });
        cx += cols[3];
        doc.font('Helvetica-Bold').text(formatRs(item.lineTotal), cx + 4, y + 6, {
          width: cols[4] - 8,
          align: 'right',
        });

        y += sub ? 30 : 24;
      });

      y += 10;

      const totalsW = 220;
      const totalsX = left + pageW - totalsW;
      const totalsH = 118 + (detail.taxSummary?.length ? detail.taxSummary.length * 11 : 0);
      drawSoftCard(doc, totalsX, y, totalsW, totalsH, 8);

      let ty = y + 10;
      const row = (label: string, val: string, bold = false) => {
        doc.fillColor(INV.muted).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
        doc.text(label, totalsX + 12, ty, { width: 100 });
        doc.fillColor(INV.ink).text(val, totalsX + 12, ty, { width: totalsW - 24, align: 'right' });
        ty += bold ? 16 : 12;
      };

      row('Taxable', formatRs(taxableAmount(detail)));
      if (detail.lineDiscountTotal > 0) row('Line discount', `− ${formatRs(detail.lineDiscountTotal)}`);
      if (detail.billDiscount > 0) row('Bill discount', `− ${formatRs(detail.billDiscount)}`);
      if (detail.cgstTotal > 0) row('CGST', formatRs(detail.cgstTotal));
      if (detail.sgstTotal > 0) row('SGST', formatRs(detail.sgstTotal));
      if (detail.igstTotal > 0) row('IGST', formatRs(detail.igstTotal));
      if (Math.abs(detail.roundOff) >= 0.005) {
        row('Round off', formatRs(detail.roundOff));
      }

      doc.strokeColor(INV.line).moveTo(totalsX + 12, ty).lineTo(totalsX + totalsW - 12, ty).stroke();
      ty += 8;

      doc.fillColor(INV.accentDark).font('Helvetica-Bold').fontSize(14);
      doc.text(formatRs(detail.grandTotal), totalsX + 12, ty, { width: totalsW - 24, align: 'right' });
      ty += 18;
      doc.fillColor(INV.muted).font('Helvetica').fontSize(7);
      doc.text('Grand total', totalsX + 12, ty - 14, { width: 80 });

      y += totalsH + 14;

      doc.fillColor(INV.muted).font('Helvetica').fontSize(7.5);
      doc.text(`In words: ${amountInWords(detail.grandTotal)}`, left, y, { width: pageW - totalsW - 16 });

      y += 18;
      doc.save();
      doc.roundedRect(left, y, 90, 18, 9).fill(INV.success);
      doc.fillColor(INV.white).font('Helvetica-Bold').fontSize(8);
      doc.text(paymentLabel(detail), left + 10, y + 5, { width: 70, align: 'center' });
      doc.restore();

      if (detail.taxSummary?.length) {
        y += 28;
        doc.fillColor(INV.muted).font('Helvetica-Bold').fontSize(7.5).text('GST summary', left, y);
        y += 10;
        detail.taxSummary.forEach((row) => {
          doc.font('Helvetica').fontSize(7).text(
            `${row.gstPercent}% on ${formatRs(row.taxable)}  →  CGST ${formatRs(row.cgst)}  SGST ${formatRs(row.sgst)}`,
            left,
            y,
          );
          y += 10;
        });
      }

      const footY = doc.page.height - 48;
      if (detail.company.footer) {
        doc.fillColor(INV.ink).font('Helvetica-Bold').fontSize(9);
        doc.text(detail.company.footer, left, footY, { width: pageW, align: 'center' });
      }
      if (detail.company.terms) {
        doc.fillColor(INV.muted).font('Helvetica').fontSize(7);
        doc.text(detail.company.terms, left, footY + 12, { width: pageW, align: 'center' });
      }
      doc.fillColor(INV.muted).fontSize(6.5).text(
        'Computer-generated invoice · Thank you for your purchase',
        left,
        doc.page.height - 28,
        { width: pageW, align: 'center' },
      );

      doc.end();
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });
  }

  private writeModernThermalPdf(detail: InvoiceDetailDto, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: [226, 900], margin: 10 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const w = 206;
      const x = 10;
      let y = 10;

      doc.save();
      doc.rect(x, y, w, 3).fill(INV.accent);
      doc.restore();
      y += 10;

      doc.fillColor(INV.ink).font('Helvetica-Bold').fontSize(11);
      doc.text(detail.company.name, x, y, { width: w, align: 'center' });
      y += 14;
      doc.font('Helvetica').fontSize(7).fillColor(INV.muted);
      if (detail.company.gstin) {
        doc.text(`GSTIN ${detail.company.gstin}`, x, y, { width: w, align: 'center' });
        y += 9;
      }

      doc.fillColor(INV.accent).font('Helvetica-Bold').fontSize(9);
      doc.text('INVOICE', x, y, { width: w, align: 'center' });
      y += 12;
      doc.fillColor(INV.ink).font('Helvetica').fontSize(8);
      doc.text(detail.invoiceNo, x, y);
      doc.text(formatInvoiceDate(detail.invoiceDate), x, y, { width: w, align: 'right' });
      y += 12;
      doc.text(detail.customer.name, x, y, { width: w });
      if (detail.customer.mobile) {
        y += 9;
        doc.fillColor(INV.muted).text(detail.customer.mobile, x, y);
      }
      y += 8;
      doc.strokeColor(INV.line).moveTo(x, y).lineTo(x + w, y).stroke();
      y += 6;

      detail.items.forEach((item, i) => {
        doc.fillColor(INV.ink).font('Helvetica-Bold').fontSize(8);
        doc.text(item.productName.slice(0, 32), x, y, { width: w });
        y += 10;
        doc.font('Helvetica').fontSize(7).fillColor(INV.muted);
        const meta = [
          item.batchNumber ? `B:${item.batchNumber}` : '',
          `${item.qty} x ${formatRs(item.rate)}`,
        ]
          .filter(Boolean)
          .join('  ');
        doc.text(meta, x, y);
        doc.fillColor(INV.ink).font('Helvetica-Bold').text(formatRs(item.lineTotal), x, y, {
          width: w,
          align: 'right',
        });
        y += 12;
      });

      y += 4;
      doc.strokeColor(INV.line).moveTo(x, y).lineTo(x + w, y).stroke();
      y += 8;
      doc.fillColor(INV.accentDark).font('Helvetica-Bold').fontSize(11);
      doc.text(formatRs(detail.grandTotal), x, y, { width: w, align: 'right' });
      y += 14;
      doc.fillColor(INV.muted).font('Helvetica').fontSize(6.5);
      doc.text(paymentLabel(detail), x, y, { width: w, align: 'center' });
      y += 12;
      doc.text('Thank you!', x, y, { width: w, align: 'center' });

      doc.end();
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });
  }
}
