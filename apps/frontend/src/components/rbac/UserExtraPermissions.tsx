'use client';

import { useEffect, useState } from 'react';
import { PERMISSION_CATALOG } from '@billing/shared';
import { FormModal } from '@/components/masters/FormModal';
import {
  useGetUserPermissionsQuery,
  useSetUserPermissionsMutation,
} from '@/services/api/rbacApi';

interface Props {
  userId: string;
  username: string;
  show: boolean;
  onClose: () => void;
}

export function UserExtraPermissions({ userId, username, show, onClose }: Props) {
  const { data, refetch } = useGetUserPermissionsQuery(userId, { skip: !show || !userId });
  const [setPerms, { isLoading: saving }] = useSetUserPermissionsMutation();
  const [extraGrants, setExtraGrants] = useState<Set<string>>(new Set());
  const [extraRevokes, setExtraRevokes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (data) {
      setExtraGrants(new Set(data.directGrants));
      setExtraRevokes(new Set(data.directRevokes));
    }
  }, [data]);

  const toggleGrant = (code: string) => {
    const g = new Set(extraGrants);
    const r = new Set(extraRevokes);
    r.delete(code);
    if (g.has(code)) g.delete(code);
    else g.add(code);
    setExtraGrants(g);
    setExtraRevokes(r);
  };

  const toggleRevoke = (code: string) => {
    const g = new Set(extraGrants);
    const r = new Set(extraRevokes);
    g.delete(code);
    if (r.has(code)) r.delete(code);
    else r.add(code);
    setExtraGrants(g);
    setExtraRevokes(r);
  };

  const save = async () => {
    await setPerms({
      userId,
      grants: [...extraGrants],
      revokes: [...extraRevokes],
    }).unwrap();
    await refetch();
    onClose();
  };

  const fromRole = new Set(data?.fromRole ?? []);

  return (
    <FormModal
      show={show}
      title={`Extra permissions — ${username}`}
      onClose={onClose}
      onSubmit={save}
      saving={saving}
    >
      <div className="alert alert-info small">
        <strong>Role:</strong> {data?.roleName ?? '—'} gives{' '}
        {data?.fromRole.length ?? 0} permissions. Below, add <em>only for this user</em> — e.g.
        give a cashier <code>master.product.view</code> without changing the Cashier role.
      </div>
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {PERMISSION_CATALOG.map((p) => {
          const inRole = fromRole.has(p.code);
          const granted = extraGrants.has(p.code);
          const revoked = extraRevokes.has(p.code);
          return (
            <div
              key={p.code}
              className="border-bottom py-2 d-flex justify-content-between align-items-start"
            >
              <div>
                <code className="small">{p.code}</code>
                <div className="small text-muted">{p.name}</div>
                {inRole && <span className="badge badge-secondary">From role</span>}
              </div>
              <div className="text-right">
                <label className="small d-block mb-0">
                  <input
                    type="checkbox"
                    checked={granted}
                    onChange={() => toggleGrant(p.code)}
                  />{' '}
                  Grant extra
                </label>
                <label className="small d-block mb-0 text-danger">
                  <input
                    type="checkbox"
                    checked={revoked}
                    disabled={!inRole}
                    onChange={() => toggleRevoke(p.code)}
                  />{' '}
                  Remove
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </FormModal>
  );
}
