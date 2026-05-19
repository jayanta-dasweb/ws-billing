'use client';

import { Provider } from 'react-redux';
import { AuthBootstrap } from '@/components/auth/AuthBootstrap';
import { GlobalLoading } from '@/components/loading/GlobalLoading';
import { NavigationListener } from '@/components/loading/NavigationListener';
import { store } from './store';

/** App-wide loaders: menu navigation, page load, API calls, redirects, saves. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <NavigationListener />
      <GlobalLoading />
      <AuthBootstrap>{children}</AuthBootstrap>
    </Provider>
  );
}
