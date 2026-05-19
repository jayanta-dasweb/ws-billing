import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { UserRole } from '@billing/shared';

export type AuthPrincipal = 'staff' | 'customer' | null;

export interface AuthUserCounter {
  id: string;
  name: string;
  isPrimary: boolean;
}

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  roleKey?: string | null;
  roleName?: string | null;
  counterId?: string;
  counterName?: string;
  counters?: AuthUserCounter[];
  permissions?: string[];
}

export interface CustomerProfile {
  id: string;
  name: string;
  mobile: string;
}

interface AuthState {
  principal: AuthPrincipal;
  user: AuthUser | null;
  customer: CustomerProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isRefreshing: boolean;
  isBootstrapped: boolean;
}

const initialState: AuthState = {
  principal: null,
  user: null,
  customer: null,
  accessToken: null,
  isAuthenticated: false,
  isRefreshing: false,
  isBootstrapped: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{ user: AuthUser; accessToken: string }>,
    ) {
      state.principal = 'staff';
      state.user = action.payload.user;
      state.customer = null;
      state.accessToken = action.payload.accessToken;
      state.isAuthenticated = true;
    },
    setCustomerCredentials(
      state,
      action: PayloadAction<{ customer: CustomerProfile; accessToken: string }>,
    ) {
      state.principal = 'customer';
      state.customer = action.payload.customer;
      state.user = null;
      state.accessToken = action.payload.accessToken;
      state.isAuthenticated = true;
    },
    setAccessToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
    },
    setRefreshing(state, action: PayloadAction<boolean>) {
      state.isRefreshing = action.payload;
    },
    setBootstrapped(state, action: PayloadAction<boolean>) {
      state.isBootstrapped = action.payload;
    },
    logout(state) {
      state.principal = null;
      state.user = null;
      state.customer = null;
      state.accessToken = null;
      state.isAuthenticated = false;
    },
  },
});

export const {
  setCredentials,
  setCustomerCredentials,
  setAccessToken,
  setRefreshing,
  setBootstrapped,
  logout,
} = authSlice.actions;
export default authSlice.reducer;
