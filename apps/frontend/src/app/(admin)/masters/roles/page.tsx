'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FormModal } from '@/components/masters/FormModal';
import { MasterListShell } from '@/components/masters/MasterListShell';
import { StatusBadge, useMasterList } from '@/components/masters/useMasterList';
import { useAppLoading } from '@/hooks/useAppLoading';
import { useCreateRoleMutation, useListRolesQuery } from '@/services/api/rbacApi';

export default function RoleMasterPage() {
  const { page, setPage, search, setSearch, debouncedSearch } = useMasterList();
  const { data, isLoading, error } = useListRolesQuery({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
  });
  const [createRole, { isLoading: creating }] = useCreateRoleMutation();
  const { startNavigation } = useAppLoading();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ key: '', name: '', description: '' });

  const openCreate = () => {
    setForm({ key: '', name: '', description: '' });
    setModal(true);
  };

  const save = async () => {
    if (!form.key.trim() || !form.name.trim()) return;
    const row = await createRole({
      key: form.key.trim().toLowerCase().replace(/\s+/g, '_'),
      name: form.name,
      description: form.description || undefined,
    }).unwrap();
    setModal(false);
    startNavigation('Opening role permissions…');
    window.location.href = `/masters/roles/${row.id}`;
  };

  return (
    <>
      <MasterListShell
        title="Role master"
        onAdd={openCreate}
        search={search}
        onSearchChange={setSearch}
        page={page}
        totalPages={data?.meta.totalPages ?? 1}
        onPageChange={setPage}
        isLoading={isLoading}
        error={error}
      >
        <p className="text-muted small px-3 pt-2 mb-0">
          Permissions use Spatie-style names: <code>group.resource.action</code> (e.g.{' '}
          <code>master.user.create</code>).
        </p>
        <table className="table table-striped table-sm mb-0">
          <thead>
            <tr>
              <th>Role</th>
              <th>Key</th>
              <th>Users</th>
              <th>Permissions</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((row) => (
              <tr key={row.id}>
                <td>
                  {row.name}
                  {row.isSystem && (
                    <span className="badge badge-info ml-1">System</span>
                  )}
                </td>
                <td>
                  <code>{row.key}</code>
                </td>
                <td>{row.userCount ?? 0}</td>
                <td>{row.permissionCount ?? 0}</td>
                <td>
                  <StatusBadge active={row.isActive} />
                </td>
                <td className="text-right">
                  <Link href={`/masters/roles/${row.id}`} className="btn btn-xs btn-outline-primary">
                    Permissions
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </MasterListShell>
      <FormModal
        show={modal}
        title="Add role"
        onClose={() => setModal(false)}
        onSubmit={save}
        saving={creating}
      >
        <div className="form-group">
          <label>Key *</label>
          <input
            className="form-control"
            placeholder="store_manager"
            value={form.key}
            onChange={(e) => setForm({ ...form, key: e.target.value })}
          />
          <small className="text-muted">Lowercase, underscores only</small>
        </div>
        <div className="form-group">
          <label>Display name *</label>
          <input
            className="form-control"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea
            className="form-control"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
      </FormModal>
    </>
  );
}
