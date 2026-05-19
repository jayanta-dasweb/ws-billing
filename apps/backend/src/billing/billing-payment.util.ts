import { BadRequestException } from '@nestjs/common';
import { PaymentMode } from '@prisma/client';
import type { PaymentAuditDetails } from '@billing/shared';
import {
  formatPaymentReference,
  resolvePaymentReference,
  validatePaymentAudit,
} from '@billing/shared';
import { round2 } from './billing-calc.util';

const LINE_MODES = new Set<PaymentMode>([
  PaymentMode.CASH,
  PaymentMode.CARD,
  PaymentMode.UPI,
  PaymentMode.CHEQUE,
  PaymentMode.DD,
  PaymentMode.CREDIT,
]);

export interface ResolvedPaymentLine {
  mode: PaymentMode;
  amount: number;
  reference: string;
  auditJson: PaymentAuditDetails | null;
  cashTendered?: number;
}

export interface CompletePaymentInput {
  paymentMode: PaymentMode;
  cashReceived?: number;
  creditNote?: string;
  audit?: PaymentAuditDetails;
  splits?: {
    mode: PaymentMode;
    amount: number;
    reference?: string;
    cashTendered?: number;
    audit?: PaymentAuditDetails;
  }[];
}

export interface ResolvedPaymentResult {
  paymentMode: PaymentMode;
  lines: ResolvedPaymentLine[];
  cashReceived: number | null;
  balanceReturn: number | null;
}

const TOLERANCE = 0.01;

function mergeCreditAudit(
  dto: CompletePaymentInput,
  audit?: PaymentAuditDetails,
): PaymentAuditDetails | undefined {
  const base = { ...audit };
  const note = dto.creditNote?.trim();
  if (note && !base.creditTerms) base.creditTerms = note;
  return Object.keys(base).length ? base : audit;
}

function assertLineMode(mode: PaymentMode, context: string) {
  if (!LINE_MODES.has(mode)) {
    throw new BadRequestException(`${context}: invalid payment mode ${mode}`);
  }
}

function resolveLine(
  mode: PaymentMode,
  amount: number,
  input: {
    reference?: string;
    audit?: PaymentAuditDetails;
    cashTendered?: number;
  },
  label: string,
): ResolvedPaymentLine {
  assertLineMode(mode, label);
  const audit = input.audit;
  const err = validatePaymentAudit(mode as import('@billing/shared').PaymentMode, audit);
  if (err) throw new BadRequestException(`${label}: ${err}`);
  const reference = resolvePaymentReference(
    mode as import('@billing/shared').PaymentMode,
    audit,
    input.reference,
  );
  if (!reference.trim()) {
    throw new BadRequestException(`${label}: payment reference could not be built`);
  }
  return {
    mode,
    amount: round2(amount),
    reference: reference.trim(),
    auditJson: audit && Object.keys(audit).length > 0 ? audit : null,
    cashTendered: input.cashTendered,
  };
}

export function resolvePayments(
  dto: CompletePaymentInput,
  grandTotal: number,
): ResolvedPaymentResult {
  if (grandTotal <= 0) {
    throw new BadRequestException('Bill total must be greater than zero');
  }

  if (dto.paymentMode === PaymentMode.SPLIT) {
    return resolveSplitPayment(dto, grandTotal);
  }

  if (dto.splits?.length === 1) {
    const s = dto.splits[0];
    const line = resolveLine(
      s.mode,
      grandTotal,
      { reference: s.reference, audit: s.audit ?? dto.audit, cashTendered: s.cashTendered },
      'Payment',
    );
    let cashReceived: number | null = null;
    let balanceReturn: number | null = null;
    if (s.mode === PaymentMode.CASH) {
      cashReceived = round2(dto.cashReceived ?? s.cashTendered ?? grandTotal);
      if (cashReceived + TOLERANCE < grandTotal) {
        throw new BadRequestException('Cash received is less than amount due');
      }
      balanceReturn = round2(cashReceived - grandTotal);
    }
    return {
      paymentMode: s.mode,
      lines: [line],
      cashReceived,
      balanceReturn,
    };
  }

  if (dto.splits && dto.splits.length >= 2) {
    return resolveSplitPayment({ ...dto, paymentMode: PaymentMode.SPLIT }, grandTotal);
  }

  assertLineMode(dto.paymentMode, 'Payment');

  const line = resolveLine(
    dto.paymentMode,
    grandTotal,
    {
      audit:
        dto.paymentMode === PaymentMode.CREDIT ? mergeCreditAudit(dto, dto.audit) : dto.audit,
    },
    'Payment',
  );

  let cashReceived: number | null = null;
  let balanceReturn: number | null = null;

  if (dto.paymentMode === PaymentMode.CASH) {
    cashReceived = round2(dto.cashReceived ?? grandTotal);
    if (cashReceived + TOLERANCE < grandTotal) {
      throw new BadRequestException(
        `Cash received (₹${cashReceived}) is less than amount due (₹${grandTotal})`,
      );
    }
    balanceReturn = round2(cashReceived - grandTotal);
  }

  return {
    paymentMode: dto.paymentMode,
    lines: [line],
    cashReceived,
    balanceReturn,
  };
}

function resolveSplitPayment(
  dto: CompletePaymentInput,
  grandTotal: number,
): ResolvedPaymentResult {
  const splits = dto.splits ?? [];
  if (splits.length < 2) {
    throw new BadRequestException('Split payment requires at least two payment lines');
  }

  const lines: ResolvedPaymentLine[] = [];
  let sum = 0;
  let totalCashTendered = 0;
  let totalCashDue = 0;

  for (let i = 0; i < splits.length; i++) {
    const s = splits[i];
    const amount = round2(s.amount);
    if (amount <= 0) {
      throw new BadRequestException(`Split line ${i + 1}: amount must be greater than zero`);
    }

    const line = resolveLine(
      s.mode,
      amount,
      { reference: s.reference, audit: s.audit, cashTendered: s.cashTendered },
      `Split line ${i + 1}`,
    );

    if (s.mode === PaymentMode.CASH && s.cashTendered !== undefined) {
      const tendered = round2(s.cashTendered);
      if (tendered + TOLERANCE < amount) {
        throw new BadRequestException(
          `Split cash line ${i + 1}: tendered ₹${tendered} is less than cash portion ₹${amount}`,
        );
      }
      totalCashTendered += tendered;
      totalCashDue += amount;
    }

    sum += amount;
    lines.push(line);
  }

  if (Math.abs(sum - grandTotal) > TOLERANCE) {
    throw new BadRequestException(
      `Split payments total ₹${round2(sum)} must equal amount due ₹${grandTotal}`,
    );
  }

  let cashReceived: number | null = null;
  let balanceReturn: number | null = null;
  const cashLines = lines.filter((l) => l.mode === PaymentMode.CASH);
  if (cashLines.length > 0) {
    if (dto.cashReceived !== undefined) {
      cashReceived = round2(dto.cashReceived);
      const cashSum = round2(cashLines.reduce((a, l) => a + l.amount, 0));
      if (cashReceived + TOLERANCE < cashSum) {
        throw new BadRequestException(`Cash received must cover cash portion (₹${cashSum})`);
      }
      balanceReturn = round2(cashReceived - cashSum);
    } else if (totalCashTendered > 0) {
      cashReceived = round2(totalCashTendered);
      balanceReturn = round2(totalCashTendered - totalCashDue);
    }
  }

  return {
    paymentMode: PaymentMode.SPLIT,
    lines,
    cashReceived,
    balanceReturn,
  };
}

/** @internal re-export for tests */
export { formatPaymentReference };
