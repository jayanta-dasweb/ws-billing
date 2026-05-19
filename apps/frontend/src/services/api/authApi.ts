import { baseApi } from './baseApi';
import { unwrapApi } from '@/utils/api';
import { setCredentials, logout } from '@/redux/slices/authSlice';
import { mapAuthUserDto, type AuthUserDto } from './authDto';

export type { AuthUserCounterDto, AuthUserDto } from './authDto';
export { mapAuthUserDto } from './authDto';

interface LoginResponse {
  accessToken: string;
  user: AuthUserDto;
}

export const authApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, { username: string; password: string }>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      transformResponse: (response: unknown) => unwrapApi<LoginResponse>(response),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            setCredentials({
              accessToken: data.accessToken,
              user: mapAuthUserDto(data.user),
            }),
          );
        } catch {
          /* login failed — UI shows error */
        }
      },
    }),
    logout: builder.mutation<{ message: string }, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          dispatch(logout());
          dispatch(baseApi.util.resetApiState());
        }
      },
    }),
    getMe: builder.query<AuthUserDto, void>({
      query: () => '/auth/me',
      transformResponse: (response: unknown) => unwrapApi<AuthUserDto>(response),
      providesTags: ['Auth'],
    }),
    getSession: builder.query<{ active: boolean; user: AuthUserDto }, void>({
      query: () => '/auth/session',
      transformResponse: (response: unknown) =>
        unwrapApi<{ active: boolean; user: AuthUserDto }>(response),
    }),
  }),
});

export const { useLoginMutation, useLogoutMutation, useGetMeQuery, useGetSessionQuery } =
  authApi;
