'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getApiErrorMessage } from '@/utils/api';
import {
  useCustomerForgotPasswordMutation,
  useCustomerResetPasswordMutation,
} from '@/services/api/customerAuthApi';

type Step = 'mobile' | 'otp' | 'password';

export default function CustomerForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('mobile');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const [requestOtp, { isLoading: requesting }] = useCustomerForgotPasswordMutation();
  const [resetPassword, { isLoading: resetting }] = useCustomerResetPasswordMutation();

  const busy = requesting || resetting;

  const onRequestOtp = async () => {
    setError('');
    setInfo('');
    setDevOtp(null);
    const m = mobile.trim();
    if (m.length < 8) {
      setError('Enter your registered mobile number');
      return;
    }
    try {
      const result = await requestOtp({ mobile: m }).unwrap();
      setInfo(result.message);
      if (result.devOtp) setDevOtp(result.devOtp);
      setStep('otp');
      setOtp('');
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not send verification code'));
    }
  };

  const onVerifyOtpContinue = () => {
    setError('');
    const code = otp.replace(/\D/g, '');
    if (code.length !== 6) {
      setError('Enter the 6-digit code sent to your mobile');
      return;
    }
    setOtp(code);
    setStep('password');
  };

  const onResetPassword = async () => {
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
      await resetPassword({
        mobile: mobile.trim(),
        otp: otp.replace(/\D/g, ''),
        password,
      }).unwrap();
      router.replace('/customer/dashboard');
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not reset password'));
    }
  };

  return (
    <div className="login-page min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="login-box" style={{ maxWidth: 400 }}>
        <div className="card card-outline card-primary shadow">
          <div className="card-header text-center border-0">
            <h1 className="h4 mb-0">Forgot password</h1>
            <p className="text-muted small mb-0 mt-1">
              We verify your identity with an OTP on your registered mobile
            </p>
          </div>
          <div className="card-body">
            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            {info && step !== 'mobile' && (
              <div className="alert alert-info py-2 small">{info}</div>
            )}
            {devOtp && (
              <div className="alert alert-warning py-2 small">
                <strong>Development:</strong> OTP is <code>{devOtp}</code> (also in server logs until
                SMS is configured).
              </div>
            )}

            {step === 'mobile' && (
              <>
                <div className="form-group mb-3">
                  <label className="small font-weight-bold">Registered mobile</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="10-digit mobile"
                    value={mobile}
                    autoFocus
                    onChange={(e) => setMobile(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void onRequestOtp()}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-block mb-2"
                  disabled={busy}
                  onClick={() => void onRequestOtp()}
                >
                  {requesting ? 'Sending code…' : 'Send verification code'}
                </button>
                <Link href="/customer/login" className="btn btn-link btn-sm btn-block">
                  Back to sign in
                </Link>
              </>
            )}

            {step === 'otp' && (
              <>
                <p className="small text-muted mb-2">
                  Code sent to <strong>{mobile.trim()}</strong>
                </p>
                <div className="form-group mb-3">
                  <label className="small font-weight-bold">Verification code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="form-control text-center"
                    style={{ letterSpacing: '0.25em', fontSize: '1.25rem' }}
                    placeholder="000000"
                    value={otp}
                    autoFocus
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(e) => e.key === 'Enter' && onVerifyOtpContinue()}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-block mb-2"
                  disabled={busy}
                  onClick={onVerifyOtpContinue}
                >
                  Continue
                </button>
                <button
                  type="button"
                  className="btn btn-link btn-sm btn-block"
                  disabled={busy}
                  onClick={() => {
                    setStep('mobile');
                    setOtp('');
                    setError('');
                  }}
                >
                  Change mobile
                </button>
                <button
                  type="button"
                  className="btn btn-link btn-sm btn-block"
                  disabled={busy}
                  onClick={() => void onRequestOtp()}
                >
                  Resend code
                </button>
              </>
            )}

            {step === 'password' && (
              <>
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
                    onKeyDown={(e) => e.key === 'Enter' && void onResetPassword()}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-block mb-2"
                  disabled={busy}
                  onClick={() => void onResetPassword()}
                >
                  {resetting ? 'Saving…' : 'Reset password & sign in'}
                </button>
                <button
                  type="button"
                  className="btn btn-link btn-sm btn-block"
                  onClick={() => {
                    setStep('otp');
                    setPassword('');
                    setConfirm('');
                    setError('');
                  }}
                >
                  Back to code
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
