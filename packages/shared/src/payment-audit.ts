import { PaymentMode } from './bill';

/** Structured payment evidence stored for audit / CA reconciliation. */
export interface PaymentAuditDetails {
  /** Cash — optional cashier note */
  remark?: string;

  /** UPI */
  upiTxnId?: string;
  upiApp?: string;
  upiPayerVpa?: string;
  upiTxnAt?: string;

  /** Card (credit / debit) */
  cardType?: 'CREDIT' | 'DEBIT';
  cardBank?: string;
  cardLast4?: string;
  cardApprovalCode?: string;
  cardRrn?: string;
  cardNetwork?: string;
  cardTerminalId?: string;

  /** Cheque */
  chequeNo?: string;
  chequeBank?: string;
  chequeBranch?: string;
  chequeDate?: string;
  chequeDrawer?: string;

  /** Demand draft */
  ddNo?: string;
  ddBank?: string;
  ddBranch?: string;
  ddDate?: string;

  /** Credit sale */
  creditTerms?: string;
  creditDueDate?: string;
  creditPoRef?: string;
}

const trim = (s?: string) => s?.trim() ?? '';

export function formatPaymentReference(
  mode: PaymentMode,
  audit: PaymentAuditDetails,
): string {
  switch (mode) {
    case PaymentMode.CASH: {
      const r = trim(audit.remark);
      return r || 'Cash';
    }
    case PaymentMode.UPI: {
      const parts = [`UPI ${trim(audit.upiTxnId)}`];
      if (audit.upiApp) parts.push(trim(audit.upiApp));
      if (audit.upiPayerVpa) parts.push(trim(audit.upiPayerVpa));
      return parts.filter(Boolean).join(' | ');
    }
    case PaymentMode.CARD: {
      const ct = audit.cardType === 'CREDIT' ? 'CC' : audit.cardType === 'DEBIT' ? 'DC' : 'Card';
      const parts = [
        `${ct} ${trim(audit.cardBank)} *${trim(audit.cardLast4)}`.trim(),
      ];
      if (audit.cardApprovalCode) parts.push(`AUTH:${trim(audit.cardApprovalCode)}`);
      if (audit.cardRrn) parts.push(`RRN:${trim(audit.cardRrn)}`);
      if (audit.cardNetwork) parts.push(trim(audit.cardNetwork));
      return parts.filter(Boolean).join(' | ');
    }
    case PaymentMode.CHEQUE: {
      const parts = [
        `CHQ ${trim(audit.chequeNo)}`,
        trim(audit.chequeBank),
        audit.chequeDate ? trim(audit.chequeDate) : '',
      ];
      return parts.filter(Boolean).join(' | ');
    }
    case PaymentMode.DD: {
      const parts = [`DD ${trim(audit.ddNo)}`, trim(audit.ddBank), trim(audit.ddDate)];
      return parts.filter(Boolean).join(' | ');
    }
    case PaymentMode.CREDIT: {
      const parts = [trim(audit.creditTerms) || 'Credit sale'];
      if (audit.creditDueDate) parts.push(`Due ${trim(audit.creditDueDate)}`);
      if (audit.creditPoRef) parts.push(`PO:${trim(audit.creditPoRef)}`);
      return parts.join(' | ');
    }
    default:
      return '';
  }
}

function isFourDigits(s: string): boolean {
  return /^\d{4}$/.test(s);
}

/** Returns user-facing validation error, or null if OK. */
export function validatePaymentAudit(
  mode: PaymentMode,
  audit: PaymentAuditDetails | undefined,
): string | null {
  const a = audit ?? {};

  switch (mode) {
    case PaymentMode.CASH:
      return null;

    case PaymentMode.UPI:
      if (!trim(a.upiTxnId)) return 'UPI transaction ID is required';
      return null;

    case PaymentMode.CARD: {
      if (!a.cardType) return 'Select credit or debit card';
      if (!trim(a.cardBank)) return 'Bank name is required';
      if (!isFourDigits(trim(a.cardLast4))) return 'Last 4 digits of card (exactly 4 numbers)';
      if (!trim(a.cardApprovalCode) && !trim(a.cardRrn)) {
        return 'Enter approval code or bank RRN / transaction reference';
      }
      return null;
    }

    case PaymentMode.CHEQUE: {
      if (!trim(a.chequeNo)) return 'Cheque number is required';
      if (!trim(a.chequeBank)) return 'Bank name is required';
      if (!trim(a.chequeDate)) return 'Cheque date is required';
      return null;
    }

    case PaymentMode.DD: {
      if (!trim(a.ddNo)) return 'DD number is required';
      if (!trim(a.ddBank)) return 'Bank name is required';
      if (!trim(a.ddDate)) return 'DD date is required';
      return null;
    }

    case PaymentMode.CREDIT:
      if (!trim(a.creditTerms) && !trim(a.creditDueDate)) {
        return 'Enter credit terms or due date';
      }
      return null;

    default:
      return null;
  }
}

export function resolvePaymentReference(
  mode: PaymentMode,
  audit: PaymentAuditDetails | undefined,
  legacyReference?: string,
): string {
  const legacy = trim(legacyReference);
  if (legacy) return legacy;
  const details = audit ?? {};
  const ref = formatPaymentReference(mode, details);
  if (ref) return ref;
  if (mode === PaymentMode.CASH) return 'Cash';
  return '';
}
