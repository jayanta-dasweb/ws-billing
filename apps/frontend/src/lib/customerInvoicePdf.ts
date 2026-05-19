import { getApiBaseUrl } from '@/lib/apiBase';

export async function downloadCustomerInvoicePdf(
  billId: string,
  accessToken: string,
  invoiceNo: string,
  format: 'a4' | 'thermal' = 'a4',
): Promise<void> {
  const res = await fetch(
    `${getApiBaseUrl()}/customer-auth/bills/${billId}/pdf?format=${format}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
    },
  );
  if (!res.ok) {
    throw new Error('Could not download PDF');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoiceNo.replace(/\//g, '-')}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
