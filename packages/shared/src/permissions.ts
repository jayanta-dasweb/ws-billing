/** Spatie-style: group.resource.action (e.g. master.user.create) */

export type PermissionAction = 'view' | 'create' | 'update' | 'delete';

export interface PermissionDef {
  code: string;
  group: string;
  resource: string;
  action: string;
  name: string;
  description?: string;
}

function p(
  group: string,
  resource: string,
  action: string,
  name: string,
  description?: string,
): PermissionDef {
  return {
    code: `${group}.${resource}.${action}`,
    group,
    resource,
    action,
    name,
    description,
  };
}

const crud = (group: string, resource: string, label: string) => [
  p(group, resource, 'view', `View ${label}`),
  p(group, resource, 'create', `Create ${label}`),
  p(group, resource, 'update', `Update ${label}`),
  p(group, resource, 'delete', `Delete ${label}`),
];

export const PERMISSION_CATALOG: PermissionDef[] = [
  ...crud('master', 'company', 'companies'),
  ...crud('master', 'counter', 'counters'),
  ...crud('master', 'customer', 'customers'),
  ...crud('master', 'product', 'products'),
  ...crud('master', 'batch', 'batches'),
  ...crud('master', 'tax', 'tax rates'),
  ...crud('master', 'payment_mode', 'payment modes'),
  ...crud('master', 'user', 'users'),
  ...crud('master', 'role', 'roles'),

  p('billing', 'counter', 'access', 'Open billing screen', 'Use the POS billing counter'),
  p('billing', 'bill', 'create', 'Add items to bills'),
  p('billing', 'bill', 'complete', 'Complete bill', 'Commit stock when bill is completed'),
  p('billing', 'bill', 'hold', 'Hold / resume bills'),

  p('inventory', 'return', 'view', 'View sales returns'),
  p('inventory', 'return', 'create', 'Create & complete returns'),
  p('inventory', 'adjustment', 'view', 'View stock adjustments'),
  p('inventory', 'adjustment', 'create', 'Create stock adjustments'),
  p('inventory', 'movement', 'view', 'View stock movement history'),

  p('audit', 'log', 'view', 'View audit logs'),

  p('reports', 'day', 'view', 'View day-end / today sales summary'),

  p('security', 'ip', 'view', 'View IP allowlists'),
  p('security', 'ip', 'manage', 'Manage IP allowlists'),
  p('security', 'permission', 'view', 'View permission setup'),
  p('security', 'permission', 'manage', 'Manage roles & permissions'),
];

export const ALL_PERMISSION_CODES = PERMISSION_CATALOG.map((x) => x.code);

export const PERMISSION_GROUPS = [...new Set(PERMISSION_CATALOG.map((x) => x.group))];

export function groupPermissionsByModule(catalog: PermissionDef[] = PERMISSION_CATALOG) {
  const groups: Record<string, Record<string, PermissionDef[]>> = {};
  for (const perm of catalog) {
    if (!groups[perm.group]) groups[perm.group] = {};
    if (!groups[perm.group][perm.resource]) groups[perm.group][perm.resource] = [];
    groups[perm.group][perm.resource].push(perm);
  }
  return groups;
}

export function parsePermissionCode(code: string) {
  const [group, resource, action] = code.split('.');
  return { group, resource, action };
}

/** System role keys (stored in roles table) */
export enum SystemRoleKey {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  CASHIER = 'cashier',
}

/** @deprecated Use dot-notation codes; kept for gradual migration */
export enum PermissionCode {
  MASTERS_VIEW = 'master.company.view',
  MASTERS_EDIT = 'master.company.create',
  USERS_MANAGE = 'master.user.create',
  BILLING_ACCESS = 'billing.counter.access',
  BILLING_COMMIT = 'billing.bill.complete',
  SECURITY_MANAGE = 'security.permission.manage',
}
