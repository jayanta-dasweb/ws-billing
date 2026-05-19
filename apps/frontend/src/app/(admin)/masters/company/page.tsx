'use client';

import { useState } from 'react';
import { FormModal } from '@/components/masters/FormModal';
import { MasterListShell } from '@/components/masters/MasterListShell';
import { StatusBadge, useMasterList } from '@/components/masters/useMasterList';
import {
  useCreateCompanyMutation,
  useListCompaniesQuery,
  useUpdateCompanyMutation,
  type Company,
} from '@/services/api/mastersApi';
import { getApiErrorMessage } from '@/utils/api';
import { MASTER_WRITE_FIELDS, pickFields } from '@/utils/pickFields';

const empty: Partial<Company> = {
  name: '',
  address: '',
  gstin: '',
  pan: '',
  phone: '',
  email: '',
  invoiceFooter: '',
  isActive: true,
};

export default function CompanyMasterPage() {
  const { page, setPage, search, setSearch, debouncedSearch } = useMasterList();
  const { data, isLoading, error } = useListCompaniesQuery({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
  });
  const [createCompany, { isLoading: creating }] = useCreateCompanyMutation();
  const [updateCompany, { isLoading: updating }] = useUpdateCompanyMutation();

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState<Partial<Company>>(empty);
  const [formError, setFormError] = useState('');

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setFormError('');
    setModal(true);
  };

  const openEdit = (row: Company) => {
    setEditing(row);
    setForm({ ...row });
    setFormError('');
    setModal(true);
  };

  const save = async () => {
    if (!form.name?.trim() || !form.address?.trim()) {
      setFormError('Name and address are required');
      return;
    }
    try {
      const body = pickFields<Partial<Company>>(form, MASTER_WRITE_FIELDS.company);
      if (editing) {
        await updateCompany({ id: editing.id, body }).unwrap();
      } else {
        await createCompany(body).unwrap();
      }
      setModal(false);
    } catch (e) {
      setFormError(getApiErrorMessage(e, 'Save failed'));
    }
  };

  return (
    <>
      <MasterListShell
        title="Company Master"
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
              <th>GSTIN</th>
              <th>Phone</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.gstin || '—'}</td>
                <td>{row.phone || '—'}</td>
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
        title={editing ? 'Edit Company' : 'Add Company'}
        onClose={() => setModal(false)}
        onSubmit={save}
        saving={creating || updating}
      >
        {formError && <div className="alert alert-danger">{formError}</div>}
        <div className="form-row">
          <div className="form-group col-md-6">
            <label>Name *</label>
            <input
              className="form-control"
              value={form.name ?? ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="form-group col-md-6">
            <label>GSTIN</label>
            <input
              className="form-control"
              value={form.gstin ?? ''}
              onChange={(e) => setForm({ ...form, gstin: e.target.value })}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Address *</label>
          <textarea
            className="form-control"
            rows={2}
            value={form.address ?? ''}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div className="form-row">
          <div className="form-group col-md-4">
            <label>Phone</label>
            <input
              className="form-control"
              value={form.phone ?? ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="form-group col-md-4">
            <label>Email</label>
            <input
              className="form-control"
              value={form.email ?? ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="form-group col-md-4">
            <label className="d-block">Active</label>
            <input
              type="checkbox"
              checked={form.isActive ?? true}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Invoice footer</label>
          <textarea
            className="form-control"
            rows={2}
            value={form.invoiceFooter ?? ''}
            onChange={(e) => setForm({ ...form, invoiceFooter: e.target.value })}
          />
        </div>
      </FormModal>
    </>
  );
}
