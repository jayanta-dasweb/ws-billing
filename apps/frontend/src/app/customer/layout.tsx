'use client';

import { usePathname } from 'next/navigation';
import { CustomerPortalNav } from '@/components/customer/CustomerPortalNav';
import '@/styles/customer-portal.css';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthScreen =
    pathname === '/customer/login' || pathname === '/customer/forgot-password';

  if (isAuthScreen) {
    return <>{children}</>;
  }

  return (
    <div className="customer-portal min-vh-100 bg-light">
      <CustomerPortalNav />
      <main>{children}</main>
    </div>
  );
}
