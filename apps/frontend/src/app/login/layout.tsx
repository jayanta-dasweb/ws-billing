'use client';

import { Suspense } from 'react';
import { GuestGuard } from '@/components/auth/GuestGuard';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="d-flex justify-content-center align-items-center min-vh-100">
          <div className="spinner-border text-primary" />
        </div>
      }
    >
      <GuestGuard>{children}</GuestGuard>
    </Suspense>
  );
}
