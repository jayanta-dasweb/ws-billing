'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageSpinner } from '@/components/loading/PageSpinner';

/** Legacy route — redirects to invoices list. */
export default function CustomerBillsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/customer/invoices');
  }, [router]);
  return <PageSpinner message="Loading…" />;
}
