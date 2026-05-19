'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { CustomerAuthGuard } from '@/components/customer/CustomerAuthGuard';
import { CustomerInvoiceDetail } from '@/components/customer/CustomerInvoiceDetail';
import { PageSpinner } from '@/components/loading/PageSpinner';
import { downloadCustomerInvoicePdf } from '@/lib/customerInvoicePdf';
import type { RootState } from '@/redux/store';
import { useGetCustomerBillDetailQuery } from '@/services/api/customerAuthApi';

function InvoiceDetailContent() {
  const params = useParams();
  const billId = typeof params.billId === 'string' ? params.billId : '';
  const accessToken = useSelector((s: RootState) => s.auth.accessToken);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const { data: detail, isLoading, isError } = useGetCustomerBillDetailQuery(billId, {
    skip: !billId,
  });

  const onDownloadPdf = async () => {
    if (!detail || !accessToken) return;
    setPdfError('');
    setPdfBusy(true);
    try {
      await downloadCustomerInvoicePdf(billId, accessToken, detail.invoiceNo, 'a4');
    } catch {
      setPdfError('Could not download PDF. Try again in a moment.');
    } finally {
      setPdfBusy(false);
    }
  };

  if (isLoading) {
    return <PageSpinner message="Loading invoice…" />;
  }

  if (isError || !detail) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger">Invoice not found or not available.</div>
        <Link href="/customer/invoices" className="btn btn-outline-primary btn-sm">
          Back to all invoices
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-4 customer-portal-content" style={{ maxWidth: 960 }}>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
        <Link href="/customer/invoices" className="btn btn-sm btn-outline-secondary">
          ← All invoices
        </Link>
        <div className="mt-2 mt-md-0">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={pdfBusy}
            onClick={() => void onDownloadPdf()}
          >
            {pdfBusy ? 'Preparing PDF…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {pdfError && <div className="alert alert-warning py-2 small">{pdfError}</div>}

      <CustomerInvoiceDetail detail={detail} />
    </div>
  );
}

export default function CustomerInvoiceDetailPage() {
  return (
    <CustomerAuthGuard>
      <InvoiceDetailContent />
    </CustomerAuthGuard>
  );
}
