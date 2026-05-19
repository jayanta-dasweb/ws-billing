/** Canonical audit action codes (append-only activity log). */
export const AuditAction = {
  // Auth & security
  LOGIN: 'auth.login',
  LOGIN_FAILED: 'auth.login_failed',
  LOGOUT: 'auth.logout',
  TOKEN_REFRESH: 'auth.token_refresh',
  SESSION_TIMEOUT: 'auth.session_timeout',
  PASSWORD_RESET: 'auth.password_reset',
  ROLE_CHANGED: 'security.role_changed',
  PERMISSION_CHANGED: 'security.permission_changed',
  IP_RULE_CHANGED: 'security.ip_rule_changed',
  ACCESS_BLOCKED: 'security.access_blocked',

  // CRUD
  CREATE: 'record.created',
  UPDATE: 'record.updated',
  DELETE: 'record.deleted',

  // Billing
  BILL_CREATED: 'billing.bill_created',
  BILL_HOLD: 'billing.bill_hold',
  BILL_RESUME: 'billing.bill_resume',
  BILL_CANCELLED: 'billing.bill_cancelled',
  BILL_COMPLETED: 'billing.bill_completed',
  BILL_TRANSFERRED: 'billing.bill_transferred',
  LINE_ADDED: 'billing.line_added',
  LINE_REMOVED: 'billing.line_removed',
  LINE_QTY_CHANGED: 'billing.line_qty_changed',
  LINE_DISCOUNT_CHANGED: 'billing.line_discount_changed',
  BILL_DISCOUNT_CHANGED: 'billing.bill_discount_changed',
  PAYMENT_CHANGED: 'billing.payment_changed',
  ROUND_OFF_CHANGED: 'billing.round_off_changed',
  CUSTOMER_CHANGED: 'billing.customer_changed',

  // Invoice
  INVOICE_REPRINT: 'invoice.reprint',

  // Returns
  RETURN_CREATED: 'returns.created',
  RETURN_COMPLETED: 'returns.completed',
  RETURN_CANCELLED: 'returns.cancelled',

  // Masters / pricing
  RATE_CHANGED: 'masters.rate_changed',
  BATCH_EXPIRY_UPDATED: 'masters.batch_expiry_updated',

  // Inventory
  STOCK_ADJUSTED: 'inventory.stock_adjusted',
  STOCK_MOVEMENT: 'inventory.stock_movement',
  STOCK_RESERVED: 'inventory.stock_reserved',
  STOCK_RELEASED: 'inventory.stock_reserved_released',
  NEGATIVE_STOCK_BLOCKED: 'inventory.negative_stock_blocked',

  // System
  API_FAILURE: 'system.api_failure',
  JOB_FAILURE: 'system.job_failure',
  WS_DISCONNECT: 'system.ws_disconnect',
} as const;

export type AuditActionCode = (typeof AuditAction)[keyof typeof AuditAction];
