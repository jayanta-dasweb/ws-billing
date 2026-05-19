'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageSpinner } from '@/components/loading/PageSpinner';

export default function CustomerIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/customer/dashboard');
  }, [router]);

  return <PageSpinner message="Loading your account…" />;
}
