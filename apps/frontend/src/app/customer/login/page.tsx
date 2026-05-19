'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import type { RootState } from '@/redux/store';
import { PageSpinner } from '@/components/loading/PageSpinner';
import { getApiErrorMessage } from '@/utils/api';
import {
  useCustomerLookupMutation,
  useCustomerLoginMutation,
  useCustomerSetPasswordMutation,
} from '@/services/api/customerAuthApi';

type Step = 'mobile' | 'password' | 'set-password';

export default function CustomerLoginPage() {
  const router = useRouter();
  const { isAuthenticated, isBootstrapped, principal } = useSelector((s: RootState) => s.auth);

  const [step, setStep] = useState<Step>('mobile');
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const [lookup, { isLoading: lookingUp }] = useCustomerLookupMutation();
  const [login, { isLoading: loggingIn }] = useCustomerLoginMutation();
  const [setPasswordMutation, { isLoading: settingPassword }] = useCustomerSetPasswordMutation();

  const busy = lookingUp || loggingIn || settingPassword;

  const onMobileContinue = async () => {
    setError('');
    const m = mobile.trim();
    if (m.length < 8) {
      setError('Enter your mobile number');
      return;
    }
    try {
      const result = await lookup({ mobile: m }).unwrap();
      setName(result.name);
      setStep(result.needsPassword ? 'set-password' : 'password');
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not find your account'));
    }
  };

  const onLogin = async () => {
    setError('');
    try {
      await login({ mobile: mobile.trim(), password }).unwrap();
      router.replace('/customer/dashboard');
    } catch (e) {
      setError(getApiErrorMessage(e, 'Invalid mobile or password'));
    }
  };

  const onSetPassword = async () => {
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    try {
      await setPasswordMutation({ mobile: mobile.trim(), password }).unwrap();
      router.replace('/customer/dashboard');
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not set password'));
    }
  };

  useEffect(() => {
    if (!isBootstrapped) return;
    if (isAuthenticated && principal === 'customer') {
      router.replace('/customer/dashboard');
    }
  }, [isBootstrapped, isAuthenticated, principal, router]);

  if (!isBootstrapped) {
    return <PageSpinner message="Loading…" />;
  }

  if (isAuthenticated && principal === 'customer') {
    return <PageSpinner message="Redirecting…" />;
  }

  return (
    <div className="login-page min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="login-box" style={{ maxWidth: 400 }}>
        <div className="card card-outline card-primary shadow">
          <div className="card-header text-center border-0">
            <h1 className="h4 mb-0">Customer sign in</h1>
            <p className="text-muted small mb-0 mt-1">
              View invoices, purchase history &amp; analytics
            </p>
          </div>
          <div className="card-body">
            {error && <div className="alert alert-danger py-2 small">{error}</div>}

            {step === 'mobile' && (
              <>
                <div className="form-group mb-3">
                  <label className="small font-weight-bold">Mobile</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="10-digit mobile"
                    value={mobile}
                    autoFocus
                    onChange={(e) => setMobile(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void onMobileContinue()}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  disabled={busy}
                  onClick={() => void onMobileContinue()}
                >
                  {lookingUp ? 'Checking…' : 'Continue'}
                </button>
              </>
            )}

            {step === 'password' && (
              <>
                <p className="small mb-2">
                  Welcome, <strong>{name}</strong>
                </p>
                <div className="form-group mb-3">
                  <label className="small font-weight-bold">Password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={password}
                    autoFocus
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void onLogin()}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-block mb-2"
                  disabled={busy}
                  onClick={() => void onLogin()}
                >
                  {loggingIn ? 'Signing in…' : 'Sign in'}
                </button>
                <Link
                  href="/customer/forgot-password"
                  className="btn btn-link btn-sm btn-block"
                >
                  Forgot password?
                </Link>
                <button
                  type="button"
                  className="btn btn-link btn-sm btn-block"
                  onClick={() => {
                    setStep('mobile');
                    setPassword('');
                    setError('');
                  }}
                >
                  Change mobile
                </button>
              </>
            )}

            {step === 'set-password' && (
              <>
                <p className="small mb-2">
                  Welcome, <strong>{name}</strong>. This is your first visit — create a password to
                  access your dashboard, invoices, and purchase insights. Only you can set this
                  password.
                </p>
                <div className="form-group mb-2">
                  <label className="small font-weight-bold">New password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={password}
                    autoFocus
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="form-group mb-3">
                  <label className="small font-weight-bold">Confirm password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void onSetPassword()}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-block mb-2"
                  disabled={busy}
                  onClick={() => void onSetPassword()}
                >
                  {settingPassword ? 'Saving…' : 'Set password & sign in'}
                </button>
                <button
                  type="button"
                  className="btn btn-link btn-sm btn-block"
                  onClick={() => {
                    setStep('mobile');
                    setPassword('');
                    setConfirm('');
                    setError('');
                  }}
                >
                  Change mobile
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
