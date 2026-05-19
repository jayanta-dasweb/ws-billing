'use client';

import { useState } from 'react';
import { FormModal } from '@/components/masters/FormModal';
import { NumericInput } from '@/components/masters/NumericInput';
import { MasterListShell } from '@/components/masters/MasterListShell';
import { StatusBadge, useMasterList } from '@/components/masters/useMasterList';
import {
  useCreateTaxMutation,
  useListTaxesQuery,
  useUpdateTaxMutation,
  type TaxMaster,
} from '@/services/api/mastersApi';

export default function TaxMasterPage() {
  const { page, setPage, search, setSearch, debouncedSearch } = useMasterList();
  const { data, isLoading, error } = useListTaxesQuery({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
  });
  const [createTax, { isLoading: creating }] = useCreateTaxMutation();
  const [updateTax, { isLoading: updating }] = useUpdateTaxMutation();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<TaxMaster | null>(null);
  const [form, setForm] = useState({ name: '', gstPercent: 12, isActive: true });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', gstPercent: 12, isActive: true });
    setModal(true);
  };

  const openEdit = (row: TaxMaster) => {
    setEditing(row);
    setForm({
      name: row.name,
      gstPercent: Number(row.gstPercent),
      isActive: row.isActive,
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    const body = { name: form.name, gstPercent: form.gstPercent, isActive: form.isActive };
    if (editing) await updateTax({ id: editing.id, body }).unwrap();
    else await createTax(body).unwrap();
    setModal(false);
  };

  return (
    <>
      <MasterListShell
        title="Tax Master"
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
              <th>GST %</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.gstPercent}%</td>
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
        title={editing ? 'Edit Tax' : 'Add Tax'}
        onClose={() => setModal(false)}
        onSubmit={save}
        saving={creating || updating}
      >
        <div className="form-row">
          <div className="form-group col-md-6">
            <label>Name *</label>
            <input
              className="form-control"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="form-group col-md-6">
            <label>GST % *</label>
            <NumericInput
              value={form.gstPercent}
              onChange={(gstPercent) => setForm({ ...form, gstPercent })}
            />
          </div>
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
    </>
  );
}