'use client';

import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  setOverlay,
  startRouteLoading,
  stopRouteLoading,
} from '@/redux/slices/uiSlice';

export function useAppLoading() {
  const dispatch = useDispatch();

  const showOverlay = useCallback(
    (message?: string) => dispatch(setOverlay({ active: true, message })),
    [dispatch],
  );

  const hideOverlay = useCallback(
    () => dispatch(setOverlay({ active: false })),
    [dispatch],
  );

  const withOverlay = useCallback(
    async <T>(fn: () => Promise<T>, message = 'Please wait…'): Promise<T> => {
      dispatch(setOverlay({ active: true, message }));
      try {
        return await fn();
      } finally {
        dispatch(setOverlay({ active: false }));
      }
    },
    [dispatch],
  );

  const startNavigation = useCallback(
    (message?: string) => dispatch(startRouteLoading(message)),
    [dispatch],
  );

  const stopNavigation = useCallback(() => dispatch(stopRouteLoading()), [dispatch]);

  return {
    showOverlay,
    hideOverlay,
    withOverlay,
    startNavigation,
    stopNavigation,
  };
}
