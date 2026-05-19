'use client';

import { PERMISSION_CATALOG, groupPermissionsByModule } from '@billing/shared';

const GROUP_LABELS: Record<string, string> = {
  master: 'Master data',
  billing: 'Billing / POS',
  security: 'Security & access',
};

const RESOURCE_LABELS: Record<string, string> = {
  company: 'Company',
  counter: 'Counters',
  customer: 'Customers',
  product: 'Products',
  batch: 'Batches',
  tax: 'Tax rates',
  payment_mode: 'Payment modes',
  user: 'Users',
  role: 'Roles',
  bill: 'Bills',
  ip: 'IP allowlist',
  permission: 'Permissions',
};

const ACTION_LABELS: Record<string, string> = {
  view: 'View',
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  access: 'Access',
  complete: 'Complete',
  hold: 'Hold',
  manage: 'Manage',
};

interface PermissionPickerProps {
  selected: Set<string>;
  onChange: (codes: Set<string>) => void;
  readOnly?: boolean;
}

export function PermissionPicker({ selected, onChange, readOnly }: PermissionPickerProps) {
  const grouped = groupPermissionsByModule(PERMISSION_CATALOG);

  const toggle = (code: string) => {
    if (readOnly) return;
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange(next);
  };

  const toggleResource = (codes: string[]) => {
    if (readOnly) return;
    const allOn = codes.every((c) => selected.has(c));
    const next = new Set(selected);
    for (const c of codes) {
      if (allOn) next.delete(c);
      else next.add(c);
    }
    onChange(next);
  };

  return (
    <div className="permission-picker">
      {Object.entries(grouped).map(([group, resources]) => (
        <div key={group} className="card card-outline card-secondary mb-3">
          <div className="card-header py-2">
            <strong>{GROUP_LABELS[group] ?? group}</strong>
            <small className="text-muted ml-2">({group}.*)</small>
          </div>
          <div className="card-body py-2">
            {Object.entries(resources).map(([resource, perms]) => {
              const codes = perms.map((p) => p.code);
              return (
                <div key={resource} className="mb-3 border-bottom pb-2">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="font-weight-bold">
                      {RESOURCE_LABELS[resource] ?? resource}
                      <code className="text-muted small ml-1">
                        {group}.{resource}
                      </code>
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        className="btn btn-xs btn-outline-secondary"
                        onClick={() => toggleResource(codes)}
                      >
                        Toggle all
                      </button>
                    )}
                  </div>
                  <div className="row">
                    {perms.map((p) => (
                      <div key={p.code} className="col-md-6 col-lg-4">
                        <label className="d-block small mb-1">
                          <input
                            type="checkbox"
                            disabled={readOnly}
                            checked={selected.has(p.code)}
                            onChange={() => toggle(p.code)}
                          />{' '}
                          {ACTION_LABELS[p.action] ?? p.action}
                          <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>
                            {p.code}
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
