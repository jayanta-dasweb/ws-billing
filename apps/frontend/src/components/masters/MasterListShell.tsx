'use client';

import type { ReactNode } from 'react';
import { getApiErrorMessage, isFetchBaseQueryError } from '@/utils/api';

interface MasterListShellProps {
  title: string;
  onAdd: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  isLoading?: boolean;
  error?: string | unknown;
  children: ReactNode;
}

function formatLoadError(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (isFetchBaseQueryError(error) && error.status === 403) {
    return 'You do not have permission to view this master. Ask an administrator to assign the correct role.';
  }
  return getApiErrorMessage(error, 'Failed to load data');
}

export function MasterListShell({
  title,
  onAdd,
  search,
  onSearchChange,
  page,
  totalPages,
  onPageChange,
  isLoading,
  error,
  children,
}: MasterListShellProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title mb-0">{title}</h3>
      </div>
      <div className="card-header py-2 border-top-0">
        <div className="row align-items-center">
          <div className="col-md-4">
            <input
              type="search"
              className="form-control form-control-sm"
              placeholder="Search…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <div className="col-md-8 text-md-right mt-2 mt-md-0">
            <button type="button" className="btn btn-primary btn-sm" onClick={onAdd}>
              <i className="fas fa-plus mr-1" /> Add
            </button>
          </div>
        </div>
      </div>
      <div className="card-body p-0">
        {error ? (
          <div className="alert alert-danger m-3 mb-0">{formatLoadError(error)}</div>
        ) : null}
        <div className="app-table-loader">
          {isLoading && (
            <div className="app-table-loader__overlay">
              <div className="text-center">
                <div className="spinner-border text-primary" role="status" />
                <p className="text-muted small mb-0 mt-2">Loading data…</p>
              </div>
            </div>
          )}
          <div className={isLoading ? 'app-table-loader__content--dimmed' : undefined}>{children}</div>
        </div>
        {totalPages > 1 ? (
          <div className="card-footer clearfix">
            <ul className="pagination pagination-sm m-0 float-right">
              <li className={`page-item${page <= 1 ? ' disabled' : ''}`}>
                <button type="button" className="page-link" onClick={() => onPageChange(page - 1)}>
                  Prev
                </button>
              </li>
              <li className="page-item disabled">
                <span className="page-link">
                  {page} / {totalPages}
                </span>
              </li>
              <li className={`page-item${page >= totalPages ? ' disabled' : ''}`}>
                <button type="button" className="page-link" onClick={() => onPageChange(page + 1)}>
                  Next
                </button>
              </li>
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
