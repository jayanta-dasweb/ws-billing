export enum BillStatus {
  DRAFT = 'DRAFT',
  HOLD = 'HOLD',
  PENDING_COMMIT = 'PENDING_COMMIT',
  COMMITTING = 'COMMITTING',
  COMPLETED = 'COMPLETED',
  FAILED_STOCK = 'FAILED_STOCK',
  CANCELLED = 'CANCELLED',
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  CASHIER = 'CASHIER',
}

export enum CustomerType {
  WALK_IN = 'WALK_IN',
  BUSINESS = 'BUSINESS',
}

export enum PaymentMode {
  CASH = 'CASH',
  CARD = 'CARD',
  UPI = 'UPI',
  CHEQUE = 'CHEQUE',
  DD = 'DD',
  SPLIT = 'SPLIT',
  CREDIT = 'CREDIT',
}
