'use client';

import { useState } from 'react';
import { FormModal } from '@/components/masters/FormModal';
import { MasterListShell } from '@/components/masters/MasterListShell';
import { StatusBadge, useMasterList } from '@/components/masters/useMasterList';
import {
  useCreateCounterMutation,
  useListCountersQuery,
  useUpdateCounterMutation,
  type Counter,
} from '@/services/api/mastersApi';

export default function CounterMasterPage() {
  const { page, setPage, search, setSearch, debouncedSearch } = useMasterList();
  const { data, isLoading, error } = useListCountersQuery({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
  });
  const [createCounter, { isLoading: creating }] = useCreateCounterMutation();
  const [updateCounter, { isLoading: updating }] = useUpdateCounterMutation();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Counter | null>(null);
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setIsActive(true);
    setModal(true);
  };

  const openEdit = (row: Counter) => {
    setEditing(row);
    setName(row.name);
    setIsActive(row.isActive);
    setModal(true);
  };

  const save = async () => {
    if (!name.trim()) return;
    if (editing) {
      await updateCounter({ id: editing.id, body: { name, isActive } }).unwrap();
    } else {
      await createCounter({ name, isActive }).unwrap();
    }
    setModal(false);
  };

  return (
    <>
      <MasterListShell
        title="Counter Master"
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
              <th>Name</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>
                  <StatusBadge active={row.isActive} />
                </td>
                <td className="text-right">
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
        title={editing ? 'Edit Counter' : 'Add Counter'}
        onClose={() => setModal(false)}
        onSubmit={save}
        saving={creating || updating}
      >
        <div className="form-group">
          <label>Name *</label>
          <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="d-block">Active</label>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        </div>
      </FormModal>
    </>
  );
}
