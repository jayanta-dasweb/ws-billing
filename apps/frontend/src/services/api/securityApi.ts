import { PermissionCode, UserRole } from '@billing/shared';
import { baseApi } from './baseApi';
import { unwrapApi } from '@/utils/api';

export interface PermissionRow {
  code: string;
  name: string;
  module: string;
  description?: string | null;
}

export interface RoleMatrix {
  permissions: PermissionRow[];
  rolePermissions: Record<string, string[]>;
}

export interface CounterIpRule {
  id: string;
  counterId: string;
  cidr: string;
  label?: string | null;
  isActive: boolean;
}

export const securityApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getPermissionMatrix: builder.query<RoleMatrix, void>({
      query: () => '/security/permissions/matrix',
      transformResponse: (r) => unwrapApi<RoleMatrix>(r),
      providesTags: ['Security'],
    }),
    updateRolePermissions: builder.mutation<
      RoleMatrix,
      { role: UserRole; permissions: string[] }
    >({
      query: ({ role, permissions }) => ({
        url: `/security/permissions/roles/${role}`,
        method: 'PUT',
        body: { permissions },
      }),
      transformResponse: (r) => unwrapApi<RoleMatrix>(r),
      invalidatesTags: ['Security'],
    }),
    listCounterIpRules: builder.query<CounterIpRule[], string>({
      query: (counterId) => `/security/counters/${counterId}/ip-rules`,
      transformResponse: (r) => unwrapApi<CounterIpRule[]>(r),
      providesTags: (_r, _e, counterId) => [{ type: 'Security', id: `ip-${counterId}` }],
    }),
    createCounterIpRule: builder.mutation<
      CounterIpRule,
      { counterId: string; cidr: string; label?: string }
    >({
      query: ({ counterId, ...body }) => ({
        url: `/security/counters/${counterId}/ip-rules`,
        method: 'POST',
        body,
      }),
      transformResponse: (r) => unwrapApi<CounterIpRule>(r),
      invalidatesTags: (_r, _e, { counterId }) => [{ type: 'Security', id: `ip-${counterId}` }],
    }),
    updateCounterIpRule: builder.mutation<
      CounterIpRule,
      { id: string; counterId: string; body: Partial<CounterIpRule> }
    >({
      query: ({ id, body }) => ({ url: `/security/ip-rules/${id}`, method: 'PATCH', body }),
      transformResponse: (r) => unwrapApi<CounterIpRule>(r),
      invalidatesTags: (_r, _e, { counterId }) => [{ type: 'Security', id: `ip-${counterId}` }],
    }),
  }),
});

export const {
  useGetPermissionMatrixQuery,
  useUpdateRolePermissionsMutation,
  useListCounterIpRulesQuery,
  useCreateCounterIpRuleMutation,
  useUpdateCounterIpRuleMutation,
} = securityApi;
