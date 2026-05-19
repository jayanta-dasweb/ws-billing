'use client';

import { useState } from 'react';
import { FormModal } from '@/components/masters/FormModal';
import { NumericInput } from '@/components/masters/NumericInput';
import { MasterListShell } from '@/components/masters/MasterListShell';
import { StatusBadge, useMasterList } from '@/components/masters/useMasterList';
import { MASTER_WRITE_FIELDS, pickFields } from '@/utils/pickFields';
import {
  useCreatePaymentModeMutation,
  useListPaymentModesQuery,
  useUpdatePaymentModeMutation,
  type PaymentModeMaster,
} from '@/services/api/mastersApi';

export default function PaymentModeMasterPage() {
  const { page, setPage, search, setSearch, debouncedSearch } = useMasterList();
  const { data, isLoading, error } = useListPaymentModesQuery({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
  });
  const [createMode, { isLoading: creating }] = useCreatePaymentModeMutation();
  const [updateMode, { isLoading: updating }] = useUpdatePaymentModeMutation();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<PaymentModeMaster | null>(null);
  const [form, setForm] = useState({ code: '', name: '', sortOrder: 0, isActive: true });

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', name: '', sortOrder: 0, isActive: true });
    setModal(true);
  };

  const openEdit = (row: PaymentModeMaster) => {
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) return;
    const body = pickFields<Partial<PaymentModeMaster>>(form, MASTER_WRITE_FIELDS.paymentMode);
    if (editing) await updateMode({ id: editing.id, body }).unwrap();
    else await createMode(body).unwrap();
    setModal(false);
  };

  return (
    <>
      <MasterListShell
        title="Payment Mode Master"
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
              <th>Code</th>
              <th>Name</th>
              <th>Order</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((row) => (
              <tr key={row.id}>
                <td>
                  <code>{row.code}</code>
                </td>
                <td>{row.name}</td>
                <td>{row.sortOrder}</td>
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
        title={editing ? 'Edit Payment Mode' : 'Add Payment Mode'}
        onClose={() => setModal(false)}
        onSubmit={save}
        saving={creating || updating}
      >
        <div className="form-row">
          <div className="form-group col-md-4">
            <label>Code *</label>
            <input
              className="form-control"
              value={form.code}
              disabled={!!editing}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            />
          </div>
          <div className="form-group col-md-4">
            <label>Name *</label>
            <input
              className="form-control"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="form-group col-md-4">
            <label>Sort order</label>
            <NumericInput
              value={form.sortOrder}
              onChange={(sortOrder) => setForm({ ...form, sortOrder: Math.round(sortOrder) })}
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
