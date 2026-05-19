'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageSpinner } from '@/components/loading/PageSpinner';
import { useEffect, useState } from 'react';
import { PermissionPicker } from '@/components/rbac/PermissionPicker';
import { useGetRoleQuery, useSetRolePermissionsMutation } from '@/services/api/rbacApi';
import { getApiErrorMessage } from '@/utils/api';
import { useAppLoading } from '@/hooks/useAppLoading';
import { AutoDismissAlert } from '@/components/ui/AutoDismissAlert';
import { useTimedAlerts } from '@/hooks/useTimedAlerts';

export default function RolePermissionsPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: role, isLoading } = useGetRoleQuery(id);
  const [setPerms, { isLoading: saving }] = useSetRolePermissionsMutation();
  const { withOverlay } = useAppLoading();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { message, error, setMessage, setError } = useTimedAlerts();

  useEffect(() => {
    if (role?.permissionCodes) {
      setSelected(new Set(role.permissionCodes));
    }
  }, [role]);

  const save = async () => {
    try {
      await withOverlay(async () => {
        await setPerms({ id, permissionCodes: [...selected] }).unwrap();
      }, 'Saving permissions…');
      setMessage('Permissions saved for this role');
    } catch (e) {
      setError(getApiErrorMessage(e, 'Save failed'));
    }
  };

  if (isLoading) return <PageSpinner message="Loading role…" fullScreen={false} />;
  if (!role) return <p className="text-muted">Role not found</p>;

  const readOnly = role.key === 'super_admin';

  return (
    <div>
      <div className="mb-3">
        <Link href="/masters/roles" className="text-muted">
          ← Back to roles
        </Link>
        <h2 className="mt-2 mb-0">
          {role.name} <code className="text-muted">{role.key}</code>
        </h2>
        <p className="text-muted">
          Tick what anyone with this role can do. Format: <strong>group → form → action</strong>{' '}
          (like Laravel Spatie).
        </p>
      </div>
      <AutoDismissAlert message={message} variant="success" className="mb-2" />
      <AutoDismissAlert message={error} variant="danger" className="mb-2" />
      {readOnly ? (
        <div className="alert alert-info">
          Super Admin automatically has every permission.
        </div>
      ) : (
        <>
          <PermissionPicker selected={selected} onChange={setSelected} />
          <button
            type="button"
            className="btn btn-primary mt-3"
            disabled={saving}
            onClick={save}
          >
            {saving ? 'Saving…' : 'Save role permissions'}
          </button>
        </>
      )}
    </div>
  );
}
