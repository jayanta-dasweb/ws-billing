'use client';

import { UserRole } from '@billing/shared';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { BillingLayout } from '@/layouts/BillingLayout';

export default function BillingGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard
      roles={[UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CASHIER]}
      requireCounter
    >
      <BillingLayout>{children}</BillingLayout>
    </AuthGuard>
  );
}
