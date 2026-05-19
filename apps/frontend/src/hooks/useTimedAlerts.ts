'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseTimedAlertsOptions {
  /** Ms before success/info messages clear (default 4500) */
  messageMs?: number;
  /** Ms before error messages clear (default 6500) */
  errorMs?: number;
}

/**
 * Message/error state that auto-clears after a few seconds.
 * Use for action feedback — not for persistent status like WebSocket connection.
 */
export function useTimedAlerts(options: UseTimedAlertsOptions = {}) {
  const messageMs = options.messageMs ?? 4500;
  const errorMs = options.errorMs ?? 6500;

  const [message, setMessageState] = useState('');
  const [error, setErrorState] = useState('');
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (messageTimer.current) clearTimeout(messageTimer.current);
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
  }, []);

  const clearMessageTimer = () => {
    if (messageTimer.current) {
      clearTimeout(messageTimer.current);
      messageTimer.current = null;
    }
  };

  const clearErrorTimer = () => {
    if (errorTimer.current) {
      clearTimeout(errorTimer.current);
      errorTimer.current = null;
    }
  };

  const setMessage = useCallback(
    (text: string) => {
      setMessageState(text);
      clearMessageTimer();
      if (text) {
        clearErrorTimer();
        setErrorState('');
        messageTimer.current = setTimeout(() => setMessageState(''), messageMs);
      }
    },
    [messageMs],
  );

  const setError = useCallback(
    (text: string) => {
      setErrorState(text);
      clearErrorTimer();
      if (text) {
        clearMessageTimer();
        setMessageState('');
        errorTimer.current = setTimeout(() => setErrorState(''), errorMs);
      }
    },
    [errorMs],
  );

  const clearAlerts = useCallback(() => {
    clearMessageTimer();
    clearErrorTimer();
    setMessageState('');
    setErrorState('');
  }, []);

  return { message, error, setMessage, setError, clearAlerts };
}
