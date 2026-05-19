'use client';

import { AuthGuard } from '@/components/auth/AuthGuard';
import { AdminLayout } from '@/layouts/AdminLayout';

export default function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard adminOnly>
      <AdminLayout>{children}</AdminLayout>
    </AuthGuard>
  );
}
