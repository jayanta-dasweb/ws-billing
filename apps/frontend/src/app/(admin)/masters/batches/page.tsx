'use client';

import { useEffect, useMemo, useState } from 'react';
import { FormModal } from '@/components/masters/FormModal';
import { MasterListShell } from '@/components/masters/MasterListShell';
import { NumericInput } from '@/components/masters/NumericInput';
import { StatusBadge, useMasterList } from '@/components/masters/useMasterList';
import {
  useCreateBatchMutation,
  useListBatchesQuery,
  useListProductsQuery,
  useUpdateBatchMutation,
  type BatchStock,
} from '@/services/api/mastersApi';

export default function BatchMasterPage() {
  const { page, setPage, search, setSearch, debouncedSearch } = useMasterList();
  const { data, isLoading, error } = useListBatchesQuery({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
  });
  const {
    data: products,
    isLoading: productsLoading,
    isFetching: productsFetching,
    isError: productsError,
    refetch: refetchProducts,
  } = useListProductsQuery({ activeOnly: true, limit: 100 });
  const [createBatch, { isLoading: creating }] = useCreateBatchMutation();
  const [updateBatch, { isLoading: updating }] = useUpdateBatchMutation();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<BatchStock | null>(null);
  const [form, setForm] = useState({
    productId: '',
    batchNumber: '',
    mrp: 0,
    sellingPrice: 0,
    discountPercent: 0,
    discountPerUnit: 0,
    stockQty: 0,
    isActive: true,
  });

  const batchProducts = useMemo(() => products?.items ?? [], [products?.items]);

  useEffect(() => {
    if (!modal || editing) return;
    if (!form.productId && batchProducts.length > 0) {
      setForm((f) => ({ ...f, productId: batchProducts[0].id }));
    }
  }, [modal, editing, batchProducts, form.productId]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      productId: batchProducts[0]?.id ?? '',
      batchNumber: '',
      mrp: 0,
      sellingPrice: 0,
      discountPercent: 0,
      discountPerUnit: 0,
      stockQty: 0,
      isActive: true,
    });
    setModal(true);
    void refetchProducts();
  };

  const openEdit = (row: BatchStock) => {
    setEditing(row);
    setForm({
      productId: row.productId,
      batchNumber: row.batchNumber,
      mrp: Number(row.mrp),
      sellingPrice: Number(row.sellingPrice),
      discountPercent: Number(row.discountPercent ?? 0),
      discountPerUnit: Number(row.discountPerUnit ?? 0),
      stockQty: Number(row.stockQty),
      isActive: row.isActive,
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.productId || !form.batchNumber.trim()) return;
    const body = {
      productId: form.productId,
      batchNumber: form.batchNumber,
      mrp: form.mrp,
      sellingPrice: form.sellingPrice,
      discountPercent: form.discountPercent,
      discountPerUnit: form.discountPerUnit,
      stockQty: form.stockQty,
      isActive: form.isActive,
    };
    if (editing) await updateBatch({ id: editing.id, body }).unwrap();
    else await createBatch(body).unwrap();
    setModal(false);
  };

  const productsBusy = productsLoading || productsFetching;

  return (
    <>
      <MasterListShell
        title="Batch Master"
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
              <th>Product</th>
              <th>Batch ID</th>
              <th>Batch</th>
              <th>Stock</th>
              <th>Scheme</th>
              <th>Available</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((row) => (
              <tr key={row.id}>
                <td>{row.product?.name ?? row.productId}</td>
                <td className="small text-muted text-truncate" style={{ maxWidth: 120 }} title={row.id}>
                  {row.id}
                </td>
                <td>{row.batchNumber}</td>
                <td>{Number(row.stockQty)}</td>
                <td className="small">
                  {Number(row.discountPercent ?? 0) > 0 && (
                    <span className="badge badge-success mr-1">{Number(row.discountPercent)}%</span>
                  )}
                  {Number(row.discountPerUnit ?? 0) > 0 && (
                    <span className="badge badge-info">₹{Number(row.discountPerUnit)}/u</span>
                  )}
                  {Number(row.discountPercent ?? 0) <= 0 && Number(row.discountPerUnit ?? 0) <= 0 && '—'}
                </td>
                <td>{row.availableQty ?? Number(row.stockQty) - Number(row.pendingQty)}</td>
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
        title={editing ? 'Edit Batch' : 'Add Batch'}
        onClose={() => setModal(false)}
        onSubmit={save}
        saving={creating || updating}
      >
        {!editing && (
          <div className="form-group">
            <label>Product *</label>
            <select
              className="form-control"
              value={form.productId}
              disabled={productsBusy}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
            >
              <option value="">
                {productsBusy ? 'Loading products…' : 'Select product'}
              </option>
              {batchProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.barcode ? ` (${p.barcode})` : ''}
                </option>
              ))}
            </select>
            {productsError && (
              <small className="text-danger d-block mt-1">
                Could not load products. Refresh the page or try again.
              </small>
            )}
            {!productsBusy && !productsError && batchProducts.length === 0 && (
              <small className="text-danger d-block mt-1">
                No active products found. Add a product in Product Master first.
              </small>
            )}
          </div>
        )}
        <div className="form-row">
          <div className="form-group col-md-6">
            <label>Batch number *</label>
            <input
              className="form-control"
              value={form.batchNumber}
              disabled={!!editing}
              onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
            />
          </div>
          <div className="form-group col-md-6">
            <label>Stock qty</label>
            <NumericInput
              value={form.stockQty}
              onChange={(stockQty) => setForm({ ...form, stockQty })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-6">
            <label>MRP</label>
            <NumericInput value={form.mrp} onChange={(mrp) => setForm({ ...form, mrp })} />
          </div>
          <div className="form-group col-md-6">
            <label>Selling price</label>
            <NumericInput
              value={form.sellingPrice}
              onChange={(sellingPrice) => setForm({ ...form, sellingPrice })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-6">
            <label>Batch discount %</label>
            <NumericInput
              value={form.discountPercent}
              onChange={(discountPercent) => setForm({ ...form, discountPercent })}
            />
            <small className="text-muted d-block">Overrides product default on billing</small>
          </div>
          <div className="form-group col-md-6">
            <label>Batch discount ₹ / unit</label>
            <NumericInput
              value={form.discountPerUnit}
              onChange={(discountPerUnit) => setForm({ ...form, discountPerUnit })}
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
