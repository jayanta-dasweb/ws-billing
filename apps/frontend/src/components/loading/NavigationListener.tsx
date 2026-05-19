'use client';

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { startRouteLoading, stopRouteLoading } from '@/redux/slices/uiSlice';

function NavigationListenerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  const prevRouteKey = useRef<string | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const routeKey = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:'))
        return;
      if (anchor.target === '_blank') return;

      let url: URL;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const targetKey = `${url.pathname}${url.search}`;
      if (targetKey === routeKey) return;

      dispatch(startRouteLoading('Loading page…'));
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dispatch, routeKey]);

  useEffect(() => {
    if (prevRouteKey.current !== null && prevRouteKey.current !== routeKey) {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        dispatch(stopRouteLoading());
        settleTimer.current = null;
      }, 120);
    }
    prevRouteKey.current = routeKey;

    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [routeKey, dispatch]);

  return null;
}

export function NavigationListener() {
  return (
    <Suspense fallback={null}>
      <NavigationListenerInner />
    </Suspense>
  );
}
