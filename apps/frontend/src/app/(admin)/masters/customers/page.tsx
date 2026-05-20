'use client';

import {
  CustomerType,
  formatGstinInput,
  formatPanInput,
  normalizeIndianMobile,
  validateIndianMobile,
  validateOptionalEmail,
  validateOptionalGstin,
  validateOptionalPan,
} from '@billing/shared';
import { useState } from 'react';
import { MobileInput } from '@/components/forms/MobileInput';
import { FormModal } from '@/components/masters/FormModal';
import { MasterListShell } from '@/components/masters/MasterListShell';
import { StatusBadge, useMasterList } from '@/components/masters/useMasterList';
import { MASTER_WRITE_FIELDS, pickFields } from '@/utils/pickFields';
import {
  useCreateCustomerMutation,
  useListCustomersQuery,
  useUpdateCustomerMutation,
  type Customer,
} from '@/services/api/mastersApi';

const defaultForm = (): Partial<Customer> => ({
  name: '',
  mobile: '',
  email: '',
  gstNumber: '',
  panNumber: '',
  billingAddress: '',
  shippingAddress: '',
  creditLimit: 0,
  customerType: CustomerType.BUSINESS,
  isActive: true,
});

export default function CustomerMasterPage() {
  const { page, setPage, search, setSearch, debouncedSearch } = useMasterList();
  const { data, isLoading, error } = useListCustomersQuery({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
  });
  const [createCustomer, { isLoading: creating }] = useCreateCustomerMutation();
  const [updateCustomer, { isLoading: updating }] = useUpdateCustomerMutation();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Partial<Customer>>(defaultForm());
  const [saveError, setSaveError] = useState('');

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm());
    setSaveError('');
    setModal(true);
  };

  const openEdit = (row: Customer) => {
    setEditing(row);
    setForm({
      ...row,
      creditLimit: row.creditLimit ?? 0,
    });
    setSaveError('');
    setModal(true);
  };

  const save = async () => {
    if (!form.name?.trim()) {
      setSaveError('Name is required');
      return;
    }
    if (form.mobile?.trim()) {
      const mobileErr = validateIndianMobile(form.mobile);
      if (mobileErr) {
        setSaveError(mobileErr);
        return;
      }
    }
    const emailErr = validateOptionalEmail(form.email ?? '');
    if (emailErr) {
      setSaveError(emailErr);
      return;
    }
    const gstErr = validateOptionalGstin(form.gstNumber ?? '');
    if (gstErr) {
      setSaveError(gstErr);
      return;
    }
    const panErr = validateOptionalPan(form.panNumber ?? '');
    if (panErr) {
      setSaveError(panErr);
      return;
    }
    setSaveError('');
    const body = pickFields<Partial<Customer>>(form as Record<string, unknown>, MASTER_WRITE_FIELDS.customer);
    if (body.mobile && typeof body.mobile === 'string') {
      body.mobile = normalizeIndianMobile(body.mobile) ?? body.mobile;
    }
    if (body.gstNumber && typeof body.gstNumber === 'string') {
      body.gstNumber = formatGstinInput(body.gstNumber) || undefined;
    }
    if (body.panNumber && typeof body.panNumber === 'string') {
      body.panNumber = formatPanInput(body.panNumber) || undefined;
    }
    if (body.creditLimit !== undefined) {
      body.creditLimit = Number(body.creditLimit) || 0;
    }
    if (editing) {
      await updateCustomer({ id: editing.id, body }).unwrap();
    } else {
      await createCustomer(body).unwrap();
    }
    setModal(false);
  };

  return (
    <>
      <MasterListShell
        title="Customer Master"
        onAdd={openCreate}
        search={search}
        onSearchChange={setSearch}
        page={page}
        totalPages={data?.meta.totalPages ?? 1}
        onPageChange={setPage}
        isLoading={isLoading}
        error={error}
      >
        <p className="text-muted small px-2 mb-2">
          Search by name, mobile, GST, PAN, or email. List is paged — safe for thousands of customers.
        </p>
        <table className="table table-striped table-sm mb-0">
          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>GST</th>
              <th>Email</th>
              <th>Type</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.mobile || '—'}</td>
                <td>{row.gstNumber || '—'}</td>
                <td>{row.email || '—'}</td>
                <td>{row.customerType}</td>
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
        title={editing ? 'Edit Customer' : 'Add Customer'}
        onClose={() => setModal(false)}
        onSubmit={save}
        saving={creating || updating}
      >
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
            <label>Mobile</label>
            <MobileInput
              className="form-control"
              value={form.mobile ?? ''}
              onChange={(mobile) => setForm({ ...form, mobile })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-6">
            <label>Email</label>
            <input
              type="email"
              className="form-control"
              value={form.email ?? ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="form-group col-md-6">
            <label>Credit limit (₹)</label>
            <input
              type="number"
              min={0}
              className="form-control"
              value={form.creditLimit ?? 0}
              onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-6">
            <label>GSTIN</label>
            <input
              className="form-control"
              value={form.gstNumber ?? ''}
              maxLength={15}
              onChange={(e) => setForm({ ...form, gstNumber: formatGstinInput(e.target.value) })}
            />
          </div>
          <div className="form-group col-md-6">
            <label>PAN</label>
            <input
              className="form-control"
              value={form.panNumber ?? ''}
              maxLength={10}
              onChange={(e) => setForm({ ...form, panNumber: formatPanInput(e.target.value) })}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Billing address</label>
          <textarea
            className="form-control"
            rows={2}
            value={form.billingAddress ?? ''}
            onChange={(e) => setForm({ ...form, billingAddress: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>Shipping address</label>
          <textarea
            className="form-control"
            rows={2}
            placeholder="Leave blank if same as billing"
            value={form.shippingAddress ?? ''}
            onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })}
          />
        </div>
        <div className="form-row">
          <div className="form-group col-md-6">
            <label>Type</label>
            <select
              className="form-control"
              value={form.customerType}
              onChange={(e) =>
                setForm({ ...form, customerType: e.target.value as CustomerType })
              }
            >
              <option value={CustomerType.WALK_IN}>Walk-in</option>
              <option value={CustomerType.BUSINESS}>Business</option>
            </select>
          </div>
          <div className="form-group col-md-6">
            <label className="d-block">Active</label>
            <input
              type="checkbox"
              checked={form.isActive ?? true}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
          </div>
        </div>
        {saveError && <p className="text-danger small mb-0 mt-2">{saveError}</p>}
      </FormModal>
    </>
  );
}
