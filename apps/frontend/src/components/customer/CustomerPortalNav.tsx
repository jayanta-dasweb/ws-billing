'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import type { RootState } from '@/redux/store';
import {
  useCustomerLogoutMutation,
  useGetCustomerMeQuery,
} from '@/services/api/customerAuthApi';

const NAV = [
  { href: '/customer/dashboard', label: 'Dashboard' },
  { href: '/customer/invoices', label: 'All invoices' },
] as const;

export function CustomerPortalNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { customer } = useSelector((s: RootState) => s.auth);
  const { data: me } = useGetCustomerMeQuery();
  const [logout, { isLoading }] = useCustomerLogoutMutation();

  const profile = me ?? customer;

  return (
    <nav className="navbar navbar-expand navbar-white bg-white border-bottom shadow-sm customer-portal-nav">
      <Link href="/customer/dashboard" className="navbar-brand mb-0 h6 text-primary">
        My account
      </Link>
      <ul className="navbar-nav mx-auto">
        {NAV.map(({ href, label }) => (
          <li key={href} className="nav-item">
            <Link
              href={href}
              className={`nav-link small${pathname === href || pathname?.startsWith(`${href}/`) ? ' active font-weight-bold' : ''}`}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="d-flex align-items-center">
        <span className="small text-muted mr-3 d-none d-md-inline">
          {profile?.name}
          {profile?.mobile ? ` · ${profile.mobile}` : ''}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          disabled={isLoading}
          onClick={() => void logout().then(() => router.replace('/customer/login'))}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
