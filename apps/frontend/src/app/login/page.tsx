'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSelector } from 'react-redux';
import { useLoginMutation } from '@/services/api/authApi';
import type { RootState } from '@/redux/store';
import { resolvePostLoginPath } from '@/utils/roles';
import { getApiErrorMessage } from '@/utils/api';
import { useAppLoading } from '@/hooks/useAppLoading';
import { PageSpinner } from '@/components/loading/PageSpinner';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  const { isAuthenticated, isBootstrapped } = useSelector((s: RootState) => s.auth);
  const [login, { isLoading }] = useLoginMutation();
  const [loginError, setLoginError] = useState('');
  const { withOverlay } = useAppLoading();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const onSubmit = async (data: LoginForm) => {
    setLoginError('');
    try {
      await withOverlay(async () => {
        const result = await login(data).unwrap();
        const target = resolvePostLoginPath(
          {
            role: result.user.role,
            roleKey: result.user.roleKey,
            permissions: result.user.permissions,
            counterId: result.user.counterId ?? undefined,
          },
          redirectParam,
        );
        router.replace(target);
      }, 'Signing in…');
    } catch (e) {
      setLoginError(getApiErrorMessage(e, 'Invalid username or password'));
    }
  };

  if (!isBootstrapped) {
    return <PageSpinner message="Loading…" />;
  }

  if (isAuthenticated) {
    return <PageSpinner message="Redirecting to your workspace…" />;
  }

  return (
    <div className="login-page min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="login-box">
        <div className="card card-outline card-primary shadow">
          <div className="card-header text-center border-0">
            <h1 className="h3 mb-0">
              <b>Billing</b> POS
            </h1>
          </div>
          <div className="card-body">
            {loginError && (
              <div className="alert alert-danger py-2 small">{loginError}</div>
            )}

            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="form-group mb-3">
                <label className="small font-weight-bold">Username</label>
                <input
                  {...register('username')}
                  className={`form-control ${errors.username ? 'is-invalid' : ''}`}
                  placeholder="Enter username"
                  autoComplete="username"
                  autoFocus
                />
                {errors.username && (
                  <div className="invalid-feedback">{errors.username.message}</div>
                )}
              </div>
              <div className="form-group mb-4">
                <label className="small font-weight-bold">Password</label>
                <input
                  {...register('password')}
                  type="password"
                  className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                  placeholder="Enter password"
                  autoComplete="current-password"
                />
                {errors.password && (
                  <div className="invalid-feedback">{errors.password.message}</div>
                )}
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
