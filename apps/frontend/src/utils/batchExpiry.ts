export type ExpiryRisk = 'expired' | 'critical' | 'warning' | 'ok' | 'none';

const MS_DAY = 24 * 60 * 60 * 1000;

export function getExpiryRisk(expiryDate: string | null): ExpiryRisk {
  if (!expiryDate) return 'none';
  const exp = new Date(expiryDate);
  if (Number.isNaN(exp.getTime())) return 'none';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDay = new Date(exp);
  expDay.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((expDay.getTime() - today.getTime()) / MS_DAY);
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 30) return 'critical';
  if (daysLeft <= 90) return 'warning';
  return 'ok';
}

export function daysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const exp = new Date(expiryDate);
  if (Number.isNaN(exp.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDay = new Date(exp);
  expDay.setHours(0, 0, 0, 0);
  return Math.ceil((expDay.getTime() - today.getTime()) / MS_DAY);
}

export function expiryRiskLabel(risk: ExpiryRisk, days: number | null): string {
  switch (risk) {
    case 'expired':
      return days != null ? `EXPIRED (${Math.abs(days)}d ago)` : 'EXPIRED';
    case 'critical':
      return days != null ? `NEAR EXPIRY · ${days}d left` : 'NEAR EXPIRY';
    case 'warning':
      return days != null ? `CHECK EXPIRY · ${days}d left` : 'CHECK EXPIRY';
    case 'ok':
      return days != null ? `OK · ${days}d left` : 'OK';
    default:
      return 'NO EXPIRY DATE';
  }
}

export const EXPIRY_RISK_SORT: Record<ExpiryRisk, number> = {
  expired: 0,
  critical: 1,
  warning: 2,
  ok: 3,
  none: 4,
};

export function worstExpiryRisk(
  batches: { expiryDate: string | null }[],
): ExpiryRisk {
  let worst: ExpiryRisk = 'none';
  for (const b of batches) {
    const r = getExpiryRisk(b.expiryDate);
    if (EXPIRY_RISK_SORT[r] < EXPIRY_RISK_SORT[worst]) worst = r;
  }
  return worst;
}
