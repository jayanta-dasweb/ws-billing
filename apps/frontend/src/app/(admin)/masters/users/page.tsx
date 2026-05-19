'use client';

import { useState } from 'react';
import { FormModal } from '@/components/masters/FormModal';
import { MasterListShell } from '@/components/masters/MasterListShell';
import { StatusBadge, useMasterList } from '@/components/masters/useMasterList';
import { UserExtraPermissions } from '@/components/rbac/UserExtraPermissions';
import { useListRolesQuery } from '@/services/api/rbacApi';
import {
  useCreateUserMutation,
  useListCountersQuery,
  useListUsersQuery,
  useUpdateUserMutation,
  type MasterUser,
} from '@/services/api/mastersApi';

export default function UserMasterPage() {
  const { page, setPage, search, setSearch, debouncedSearch } = useMasterList();
  const { data, isLoading, error } = useListUsersQuery({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
  });
  const { data: counters } = useListCountersQuery({ activeOnly: true, limit: 100 });
  const { data: rolesData } = useListRolesQuery({ activeOnly: true, limit: 100 });
  const [createUser, { isLoading: creating }] = useCreateUserMutation();
  const [updateUser, { isLoading: updating }] = useUpdateUserMutation();
  const [modal, setModal] = useState(false);
  const [permModal, setPermModal] = useState<MasterUser | null>(null);
  const [editing, setEditing] = useState<MasterUser | null>(null);
  const [form, setForm] = useState({
    username: '',
    password: '',
    roleId: 'role-cashier',
    counterIds: [] as string[],
    primaryCounterId: '',
    isActive: true,
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      username: '',
      password: '',
      roleId: 'role-cashier',
      counterIds: [],
      primaryCounterId: '',
      isActive: true,
    });
    setModal(true);
  };

  const openEdit = (row: MasterUser) => {
    setEditing(row);
    const ids = row.counters?.map((c) => c.id) ?? (row.counterId ? [row.counterId] : []);
    const primary = row.counters?.find((c) => c.isPrimary)?.id ?? row.counterId ?? '';
    setForm({
      username: row.username,
      password: '',
      roleId: row.roleId ?? row.rbacRole?.id ?? 'role-cashier',
      counterIds: ids,
      primaryCounterId: primary,
      isActive: row.isActive,
    });
    setModal(true);
  };

  const toggleCounter = (id: string) => {
    setForm((f) => {
      const has = f.counterIds.includes(id);
      const counterIds = has ? f.counterIds.filter((c) => c !== id) : [...f.counterIds, id];
      const primaryCounterId =
        !has && !f.primaryCounterId
          ? id
          : f.primaryCounterId === id && has
            ? counterIds[0] ?? ''
            : f.primaryCounterId;
      return { ...f, counterIds, primaryCounterId };
    });
  };

  const save = async () => {
    if (!form.username.trim()) return;
    const payload = {
      username: form.username,
      roleId: form.roleId,
      isActive: form.isActive,
      counterIds: form.counterIds,
      primaryCounterId: form.primaryCounterId || form.counterIds[0],
    };
    if (editing) {
      const body = { ...payload, ...(form.password ? { password: form.password } : {}) };
      await updateUser({ id: editing.id, body }).unwrap();
    } else {
      if (!form.password) return;
      await createUser({ ...payload, password: form.password }).unwrap();
    }
    setModal(false);
  };

  return (
    <>
      <MasterListShell
        title="User Master"
        onAdd={openCreate}
        search={search}
        onSearchChange={setSearch}
        page={page}
        totalPages={data?.meta.totalPages ?? 1}
        onPageChange={setPage}
        isLoading={isLoading}
        error={error}
      >
        <table className="table table-striped table-sm mb-0">
          <thead>
            <tr>
              <th>Username</th>
              <th>RBAC role</th>
              <th>Counters</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((row) => (
              <tr key={row.id}>
                <td>{row.username}</td>
                <td>{row.rbacRole?.name ?? row.role}</td>
                <td>
                  {row.counters?.length
                    ? row.counters.map((c) => (
                        <span key={c.id} className="badge badge-light mr-1">
                          {c.name}
                          {c.isPrimary ? ' *' : ''}
                        </span>
                      ))
                    : row.counter?.name ?? '—'}
                </td>
                <td>
                  <StatusBadge active={row.isActive} />
                </td>
                <td className="text-right">
                  <button
                    type="button"
                    className="btn btn-xs btn-outline-secondary mr-1"
                    onClick={() => setPermModal(row)}
                  >
                    Extra perms
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs btn-outline-primary"
                    onClick={() => openEdit(row)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </MasterListShell>
      <FormModal
        show={modal}
        title={editing ? 'Edit User' : 'Add User'}
        onClose={() => setModal(false)}
        onSubmit={save}
        saving={creating || updating}
      >
        <div className="form-row">
          <div className="form-group col-md-6">
            <label>Username *</label>
            <input
              className="form-control"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>
          <div className="form-group col-md-6">
            <label>{editing ? 'New password (optional)' : 'Password *'}</label>
            <input
              type="password"
              className="form-control"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-6">
            <label>Role (from Role master)</label>
            <select
              className="form-control"
              value={form.roleId}
              onChange={(e) => setForm({ ...form, roleId: e.target.value })}
            >
              {rolesData?.items.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.key})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Assigned counters</label>
          <div className="border rounded p-2" style={{ maxHeight: 120, overflowY: 'auto' }}>
            {counters?.items.map((c) => (
              <label key={c.id} className="d-block mb-1">
                <input
                  type="checkbox"
                  checked={form.counterIds.includes(c.id)}
                  onChange={() => toggleCounter(c.id)}
                />{' '}
                {c.name}
              </label>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label>Primary counter</label>
          <select
            className="form-control"
            value={form.primaryCounterId}
            onChange={(e) => setForm({ ...form, primaryCounterId: e.target.value })}
          >
            <option value="">— Auto —</option>
            {form.counterIds.map((id) => {
              const c = counters?.items.find((x) => x.id === id);
              return c ? (
                <option key={id} value={id}>
                  {c.name}
                </option>
              ) : null;
            })}
          </select>
        </div>
        <div className="form-group">
          <label className="d-block">Active</label>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
        </div>
      </FormModal>
      {permModal && (
        <UserExtraPermissions
          userId={permModal.id}
          username={permModal.username}
          show={!!permModal}
          onClose={() => setPermModal(null)}
        />
      )}
    </>
  );
}