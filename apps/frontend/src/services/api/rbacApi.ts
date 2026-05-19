import { UserRole } from '@billing/shared';
import { baseApi } from './baseApi';
import { unwrapApi } from '@/utils/api';

export interface RoleRow {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
  userCount?: number;
  permissionCount?: number;
  permissionCodes?: string[];
}

export interface PermissionCatalog {
  permissions: { code: string; groupKey: string; resource: string; action: string; name: string }[];
  grouped: Record<string, Record<string, { code: string; name: string; action: string }[]>>;
}

export interface UserPermissionDetail {
  userId: string;
  roleId: string | null;
  roleKey: string | null;
  roleName: string | null;
  fromRole: string[];
  directGrants: string[];
  directRevokes: string[];
  effective: string[];
}

export const rbacApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getPermissionCatalog: builder.query<PermissionCatalog, void>({
      query: () => '/rbac/permissions/catalog',
      transformResponse: (r) => unwrapApi<PermissionCatalog>(r),
      providesTags: ['Rbac'],
    }),
    listRoles: builder.query<
      { items: RoleRow[]; meta: { page: number; totalPages: number } },
      { page?: number; limit?: number; search?: string; activeOnly?: boolean } | void
    >({
      query: (p) => {
        const q = new URLSearchParams();
        if (p?.page) q.set('page', String(p.page));
        if (p?.limit) q.set('limit', String(p.limit));
        if (p?.search) q.set('search', p.search);
        if (p?.activeOnly) q.set('activeOnly', 'true');
        const qs = q.toString();
        return qs ? `/rbac/roles?${qs}` : '/rbac/roles';
      },
      transformResponse: (r) => unwrapApi(r),
      providesTags: ['Rbac'],
    }),
    getRole: builder.query<RoleRow, string>({
      query: (id) => `/rbac/roles/${id}`,
      transformResponse: (r) => unwrapApi<RoleRow>(r),
      providesTags: (_r, _e, id) => [{ type: 'Rbac', id }],
    }),
    createRole: builder.mutation<
      RoleRow,
      { key: string; name: string; description?: string; permissionCodes?: string[] }
    >({
      query: (body) => ({ url: '/rbac/roles', method: 'POST', body }),
      transformResponse: (r) => unwrapApi<RoleRow>(r),
      invalidatesTags: ['Rbac'],
    }),
    updateRole: builder.mutation<RoleRow, { id: string; body: Partial<RoleRow> & { permissionCodes?: string[] } }>({
      query: ({ id, body }) => ({ url: `/rbac/roles/${id}`, method: 'PATCH', body }),
      transformResponse: (r) => unwrapApi<RoleRow>(r),
      invalidatesTags: ['Rbac'],
    }),
    setRolePermissions: builder.mutation<RoleRow, { id: string; permissionCodes: string[] }>({
      query: ({ id, permissionCodes }) => ({
        url: `/rbac/roles/${id}/permissions`,
        method: 'PUT',
        body: { permissionCodes },
      }),
      transformResponse: (r) => unwrapApi<RoleRow>(r),
      invalidatesTags: ['Rbac'],
    }),
    getUserPermissions: builder.query<UserPermissionDetail, string>({
      query: (userId) => `/rbac/users/${userId}/permissions`,
      transformResponse: (r) => unwrapApi<UserPermissionDetail>(r),
      providesTags: (_r, _e, userId) => [{ type: 'Rbac', id: `user-${userId}` }],
    }),
    setUserPermissions: builder.mutation<
      UserPermissionDetail,
      { userId: string; grants: string[]; revokes: string[] }
    >({
      query: ({ userId, grants, revokes }) => ({
        url: `/rbac/users/${userId}/permissions`,
        method: 'PUT',
        body: { grants, revokes },
      }),
      transformResponse: (r) => unwrapApi<UserPermissionDetail>(r),
      invalidatesTags: (_r, _e, { userId }) => [{ type: 'Rbac', id: `user-${userId}` }],
    }),
  }),
});

export const {
  useGetPermissionCatalogQuery,
  useListRolesQuery,
  useGetRoleQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useSetRolePermissionsMutation,
  useGetUserPermissionsQuery,
  useSetUserPermissionsMutation,
} = rbacApi;
