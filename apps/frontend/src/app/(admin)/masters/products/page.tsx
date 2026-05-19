'use client';

import { useState } from 'react';
import { FormModal } from '@/components/masters/FormModal';
import { NumericInput } from '@/components/masters/NumericInput';
import { MasterListShell } from '@/components/masters/MasterListShell';
import { StatusBadge, useMasterList } from '@/components/masters/useMasterList';
import { MASTER_WRITE_FIELDS, pickFields } from '@/utils/pickFields';
import {
  useCreateProductMutation,
  useListProductsQuery,
  useListTaxesQuery,
  useUpdateProductMutation,
  type Product,
} from '@/services/api/mastersApi';

export default function ProductMasterPage() {
  const { page, setPage, search, setSearch, debouncedSearch } = useMasterList();
  const { data, isLoading, error } = useListProductsQuery({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
  });
  const { data: taxes } = useListTaxesQuery({ activeOnly: true, limit: 100 });
  const [createProduct, { isLoading: creating }] = useCreateProductMutation();
  const [updateProduct, { isLoading: updating }] = useUpdateProductMutation();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Partial<Product>>({
    name: '',
    barcode: '',
    sku: '',
    sellingPrice: 0,
    discountPercent: 0,
    discountPerUnit: 0,
    batchEnabled: true,
    isActive: true,
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      barcode: '',
      sku: '',
      sellingPrice: 0,
      discountPercent: 0,
      discountPerUnit: 0,
      batchEnabled: true,
      isActive: true,
    });
    setModal(true);
  };

  const openEdit = (row: Product) => {
    setEditing(row);
    setForm({
      ...row,
      sellingPrice: Number(row.sellingPrice),
      discountPercent: Number(row.discountPercent ?? 0),
      discountPerUnit: Number(row.discountPerUnit ?? 0),
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.name?.trim()) return;
    const body = pickFields<Partial<Product>>(
      { ...form, sellingPrice: Number(form.sellingPrice) },
      MASTER_WRITE_FIELDS.product,
    );
    if (editing) await updateProduct({ id: editing.id, body }).unwrap();
    else await createProduct(body).unwrap();
    setModal(false);
  };

  return (
    <>
      <MasterListShell
        title="Product Master"
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
              <th>Barcode</th>
              <th>Price</th>
              <th>Tax</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.barcode || '—'}</td>
                <td>{Number(row.sellingPrice).toFixed(2)}</td>
                <td>{row.taxMaster?.name || '—'}</td>
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
        title={editing ? 'Edit Product' : 'Add Product'}
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
            <label>Barcode</label>
            <input
              className="form-control"
              value={form.barcode ?? ''}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-4">
            <label>SKU</label>
            <input
              className="form-control"
              value={form.sku ?? ''}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </div>
          <div className="form-group col-md-4">
            <label>Selling price *</label>
            <NumericInput
              value={Number(form.sellingPrice)}
              onChange={(sellingPrice) => setForm({ ...form, sellingPrice })}
            />
          </div>
          <div className="form-group col-md-4">
            <label>Tax</label>
            <select
              className="form-control"
              value={form.taxMasterId ?? ''}
              onChange={(e) =>
                setForm({ ...form, taxMasterId: e.target.value || undefined })
              }
            >
              <option value="">— None —</option>
              {taxes?.items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-6">
            <label>Default discount %</label>
            <NumericInput
              value={Number(form.discountPercent ?? 0)}
              onChange={(discountPercent) => setForm({ ...form, discountPercent })}
            />
            <small className="text-muted d-block">When batch has no scheme</small>
          </div>
          <div className="form-group col-md-6">
            <label>Default discount ₹ / unit</label>
            <NumericInput
              value={Number(form.discountPerUnit ?? 0)}
              onChange={(discountPerUnit) => setForm({ ...form, discountPerUnit })}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="mr-3">
            <input
              type="checkbox"
              checked={form.batchEnabled ?? true}
              onChange={(e) => setForm({ ...form, batchEnabled: e.target.checked })}
            />{' '}
            Batch enabled
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.isActive ?? true}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />{' '}
            Active
          </label>
        </div>
      </FormModal>
    </>
  );
}