import { redirect } from 'next/navigation';

/** Audit trail lives under Security (Spatie-style activity log). */
export default function LegacyAuditRedirect() {
  redirect('/masters/security/audit');
}
