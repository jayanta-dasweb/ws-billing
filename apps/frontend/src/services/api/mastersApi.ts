import type { CustomerType, UserRole } from '@billing/shared';
import { baseApi } from './baseApi';
import { unwrapApi } from '@/utils/api';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  activeOnly?: boolean;
  productId?: string;
}

function listQuery(path: string, params?: ListParams) {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.search) q.set('search', params.search);
  if (params?.activeOnly) q.set('activeOnly', 'true');
  if (params?.productId) q.set('productId', params.productId);
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
}

export interface Company {
  id: string;
  name: string;
  address: string;
  gstin?: string | null;
  pan?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  invoiceFooter?: string | null;
  invoiceTerms?: string | null;
  isActive: boolean;
}

export interface Counter {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Customer {
  id: string;
  name: string;
  mobile?: string | null;
  gstNumber?: string | null;
  panNumber?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  email?: string | null;
  creditLimit: string | number;
  customerType: CustomerType;
  isActive: boolean;
}

export interface TaxMaster {
  id: string;
  name: string;
  gstPercent: string | number;
  cgstPercent: string | number;
  sgstPercent: string | number;
  igstPercent: string | number;
  isActive: boolean;
}

export interface Product {
  id: string;
  name: string;
  barcode?: string | null;
  sku?: string | null;
  hsnCode?: string | null;
  taxMasterId?: string | null;
  sellingPrice: string | number;
  discountPercent?: string | number;
  discountPerUnit?: string | number;
  batchEnabled: boolean;
  isActive: boolean;
  taxMaster?: { id: string; name: string; gstPercent: string | number } | null;
}

export interface BatchStock {
  id: string;
  productId: string;
  batchNumber: string;
  expiryDate?: string | null;
  mrp: string | number;
  sellingPrice: string | number;
  discountPercent?: string | number;
  discountPerUnit?: string | number;
  stockQty: string | number;
  pendingQty: string | number;
  availableQty?: number;
  isActive: boolean;
  product?: { id: string; name: string; barcode?: string | null };
}

export interface MasterUser {
  id: string;
  username: string;
  role: UserRole;
  roleId?: string | null;
  counterId?: string | null;
  isActive: boolean;
  counter?: { id: string; name: string } | null;
  rbacRole?: { id: string; key: string; name: string } | null;
  counters?: { id: string; name: string; isPrimary: boolean; isActive?: boolean }[];
}

export interface PaymentModeMaster {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export const mastersApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    listCompanies: builder.query<Paginated<Company>, ListParams | void>({
      query: (p) => listQuery('/masters/companies', p ?? undefined),
      transformResponse: (r) => unwrapApi<Paginated<Company>>(r),
      providesTags: ['Company'],
    }),
    createCompany: builder.mutation<Company, Partial<Company>>({
      query: (body) => ({ url: '/masters/companies', method: 'POST', body }),
      transformResponse: (r) => unwrapApi<Company>(r),
      invalidatesTags: ['Company'],
    }),
    updateCompany: builder.mutation<Company, { id: string; body: Partial<Company> }>({
      query: ({ id, body }) => ({ url: `/masters/companies/${id}`, method: 'PATCH', body }),
      transformResponse: (r) => unwrapApi<Company>(r),
      invalidatesTags: ['Company'],
    }),

    listCounters: builder.query<Paginated<Counter>, ListParams | void>({
      query: (p) => listQuery('/masters/counters', p ?? undefined),
      transformResponse: (r) => unwrapApi<Paginated<Counter>>(r),
      providesTags: ['Counter'],
    }),
    createCounter: builder.mutation<Counter, Partial<Counter>>({
      query: (body) => ({ url: '/masters/counters', method: 'POST', body }),
      transformResponse: (r) => unwrapApi<Counter>(r),
      invalidatesTags: ['Counter'],
    }),
    updateCounter: builder.mutation<Counter, { id: string; body: Partial<Counter> }>({
      query: ({ id, body }) => ({ url: `/masters/counters/${id}`, method: 'PATCH', body }),
      transformResponse: (r) => unwrapApi<Counter>(r),
      invalidatesTags: ['Counter'],
    }),

    listCustomers: builder.query<Paginated<Customer>, ListParams | void>({
      query: (p) => listQuery('/masters/customers', p ?? undefined),
      transformResponse: (r) => unwrapApi<Paginated<Customer>>(r),
      providesTags: ['Customer'],
    }),
    createCustomer: builder.mutation<Customer, Partial<Customer>>({
      query: (body) => ({ url: '/masters/customers', method: 'POST', body }),
      transformResponse: (r) => unwrapApi<Customer>(r),
      invalidatesTags: ['Customer'],
    }),
    updateCustomer: builder.mutation<Customer, { id: string; body: Partial<Customer> }>({
      query: ({ id, body }) => ({ url: `/masters/customers/${id}`, method: 'PATCH', body }),
      transformResponse: (r) => unwrapApi<Customer>(r),
      invalidatesTags: ['Customer'],
    }),

    listTaxes: builder.query<Paginated<TaxMaster>, ListParams | void>({
      query: (p) => listQuery('/masters/taxes', p ?? undefined),
      transformResponse: (r) => unwrapApi<Paginated<TaxMaster>>(r),
      providesTags: ['Tax'],
    }),
    createTax: builder.mutation<TaxMaster, Partial<TaxMaster>>({
      query: (body) => ({ url: '/masters/taxes', method: 'POST', body }),
      transformResponse: (r) => unwrapApi<TaxMaster>(r),
      invalidatesTags: ['Tax'],
    }),
    updateTax: builder.mutation<TaxMaster, { id: string; body: Partial<TaxMaster> }>({
      query: ({ id, body }) => ({ url: `/masters/taxes/${id}`, method: 'PATCH', body }),
      transformResponse: (r) => unwrapApi<TaxMaster>(r),
      invalidatesTags: ['Tax'],
    }),

    listProducts: builder.query<Paginated<Product>, ListParams | void>({
      query: (p) => listQuery('/masters/products', p ?? undefined),
      transformResponse: (r) => unwrapApi<Paginated<Product>>(r),
      providesTags: ['Product'],
    }),
    createProduct: builder.mutation<Product, Partial<Product>>({
      query: (body) => ({ url: '/masters/products', method: 'POST', body }),
      transformResponse: (r) => unwrapApi<Product>(r),
      invalidatesTags: ['Product'],
    }),
    updateProduct: builder.mutation<Product, { id: string; body: Partial<Product> }>({
      query: ({ id, body }) => ({ url: `/masters/products/${id}`, method: 'PATCH', body }),
      transformResponse: (r) => unwrapApi<Product>(r),
      invalidatesTags: ['Product'],
    }),

    listBatches: builder.query<Paginated<BatchStock>, ListParams | void>({
      query: (p) => listQuery('/masters/batches', p ?? undefined),
      transformResponse: (r) => unwrapApi<Paginated<BatchStock>>(r),
      providesTags: ['Batch'],
    }),
    createBatch: builder.mutation<BatchStock, Partial<BatchStock>>({
      query: (body) => ({ url: '/masters/batches', method: 'POST', body }),
      transformResponse: (r) => unwrapApi<BatchStock>(r),
      invalidatesTags: ['Batch'],
    }),
    updateBatch: builder.mutation<BatchStock, { id: string; body: Partial<BatchStock> }>({
      query: ({ id, body }) => ({ url: `/masters/batches/${id}`, method: 'PATCH', body }),
      transformResponse: (r) => unwrapApi<BatchStock>(r),
      invalidatesTags: ['Batch'],
    }),

    listUsers: builder.query<Paginated<MasterUser>, ListParams | void>({
      query: (p) => listQuery('/masters/users', p ?? undefined),
      transformResponse: (r) => unwrapApi<Paginated<MasterUser>>(r),
      providesTags: ['User'],
    }),
    createUser: builder.mutation<
      MasterUser,
      {
        username: string;
        password: string;
        roleId: string;
        counterId?: string;
        counterIds?: string[];
        primaryCounterId?: string;
        isActive?: boolean;
      }
    >({
      query: (body) => ({ url: '/masters/users', method: 'POST', body }),
      transformResponse: (r) => unwrapApi<MasterUser>(r),
      invalidatesTags: ['User'],
    }),
    updateUser: builder.mutation<
      MasterUser,
      {
        id: string;
        body: {
          username?: string;
          password?: string;
          roleId?: string;
          counterId?: string;
          counterIds?: string[];
          primaryCounterId?: string;
          isActive?: boolean;
        };
      }
    >({
      query: ({ id, body }) => ({ url: `/masters/users/${id}`, method: 'PATCH', body }),
      transformResponse: (r) => unwrapApi<MasterUser>(r),
      invalidatesTags: ['User'],
    }),

    listPaymentModes: builder.query<Paginated<PaymentModeMaster>, ListParams | void>({
      query: (p) => listQuery('/masters/payment-modes', p ?? undefined),
      transformResponse: (r) => unwrapApi<Paginated<PaymentModeMaster>>(r),
      providesTags: ['PaymentMode'],
    }),
    createPaymentMode: builder.mutation<PaymentModeMaster, Partial<PaymentModeMaster>>({
      query: (body) => ({ url: '/masters/payment-modes', method: 'POST', body }),
      transformResponse: (r) => unwrapApi<PaymentModeMaster>(r),
      invalidatesTags: ['PaymentMode'],
    }),
    updatePaymentMode: builder.mutation<
      PaymentModeMaster,
      { id: string; body: Partial<PaymentModeMaster> }
    >({
      query: ({ id, body }) => ({
        url: `/masters/payment-modes/${id}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (r) => unwrapApi<PaymentModeMaster>(r),
      invalidatesTags: ['PaymentMode'],
    }),
  }),
});

export const {
  useListCompaniesQuery,
  useCreateCompanyMutation,
  useUpdateCompanyMutation,
  useListCountersQuery,
  useCreateCounterMutation,
  useUpdateCounterMutation,
  useListCustomersQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useListTaxesQuery,
  useCreateTaxMutation,
  useUpdateTaxMutation,
  useListProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useListBatchesQuery,
  useCreateBatchMutation,
  useUpdateBatchMutation,
  useListUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useListPaymentModesQuery,
  useCreatePaymentModeMutation,
  useUpdatePaymentModeMutation,
} = mastersApi;
