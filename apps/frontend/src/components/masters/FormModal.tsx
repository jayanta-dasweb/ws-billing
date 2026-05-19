'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import { setOverlay } from '@/redux/slices/uiSlice';
import { getApiErrorMessage } from '@/utils/api';

interface FormModalProps {
  show: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  saving?: boolean;
  children: ReactNode;
}

export function FormModal({
  show,
  title,
  onClose,
  onSubmit,
  saving,
  children,
}: FormModalProps) {
  const dispatch = useDispatch();
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!show) setSubmitError('');
  }, [show]);

  useEffect(() => {
    if (show && saving) {
      dispatch(setOverlay({ active: true, message: 'Saving…' }));
    } else if (!saving) {
      dispatch(setOverlay({ active: false }));
    }
    return () => {
      dispatch(setOverlay({ active: false }));
    };
  }, [show, saving, dispatch]);

  if (!show) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    try {
      await onSubmit();
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Save failed'));
    }
  };

  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1} role="dialog">
        <div className="modal-dialog modal-lg" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="close" onClick={onClose} aria-label="Close">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {submitError ? (
                  <div className="alert alert-danger py-2 small">{submitError}</div>
                ) : null}
                {children}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
