'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useDispatch, useSelector } from 'react-redux';
import {
  WsEvent,
  type BillCompletedPayload,
  type StockFailedPayload,
  type StockPendingUpdatedPayload,
} from '@billing/shared';
import { updateBatchStock } from '@/redux/slices/stockSlice';
import {
  setConnected,
  setLastEvent,
  setReconnecting,
  setStockAlert,
} from '@/redux/slices/websocketSlice';
import type { RootState } from '@/redux/store';

export function useBillingSocket(counterId?: string, onBillListChange?: () => void) {
  const dispatch = useDispatch();
  const socketRef = useRef<Socket | null>(null);
  const onBillListChangeRef = useRef(onBillListChange);
  onBillListChangeRef.current = onBillListChange;
  const accessToken = useSelector((s: RootState) => s.auth.accessToken);
  const connected = useSelector((s: RootState) => s.websocket.connected);

  useEffect(() => {
    if (!accessToken) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';
    const socket = io(`${wsUrl}/billing`, {
      transports: ['websocket', 'polling'],
      auth: { token: accessToken },
      query: counterId ? { counterId } : {},
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      dispatch(setConnected(true));
      dispatch(setReconnecting(false));
    });

    socket.io.on('reconnect', () => {
      dispatch(setConnected(true));
      dispatch(setReconnecting(false));
    });

    socket.on('disconnect', () => dispatch(setConnected(false)));
    socket.io.on('reconnect_attempt', () => dispatch(setReconnecting(true)));

    socket.on(WsEvent.STOCK_PENDING_UPDATED, (payload: StockPendingUpdatedPayload) => {
      dispatch(updateBatchStock(payload));
      dispatch(setLastEvent(WsEvent.STOCK_PENDING_UPDATED));
      if (payload.shortageQty == null || payload.shortageQty <= 0.001) {
        return;
      }
      const isOtherCounter = Boolean(
        payload.counterId && (!counterId || payload.counterId !== counterId),
      );
      dispatch(
        setStockAlert({
          kind: 'shortage',
          foreignShortage: isOtherCounter,
          message: isOtherCounter
            ? `${payload.counterName ?? 'Another counter'}: short ${payload.shortageQty} on batch`
            : `Stock short by ${payload.shortageQty} on this bill — check availability`,
          billId: payload.billId ?? '',
          batchId: payload.batchId,
        }),
      );
    });

    socket.on(WsEvent.STOCK_COMMITTED, (payload: StockPendingUpdatedPayload) => {
      dispatch(updateBatchStock(payload));
      dispatch(setLastEvent(WsEvent.STOCK_COMMITTED));
    });

    socket.on(WsEvent.STOCK_FAILED, (payload: StockFailedPayload) => {
      if (
        payload.stockQty != null &&
        payload.pendingQty != null &&
        payload.availableQty != null &&
        payload.productId
      ) {
        dispatch(
          updateBatchStock({
            batchId: payload.batchId,
            productId: payload.productId,
            stockQty: payload.stockQty,
            pendingQty: payload.pendingQty,
            availableQty: payload.availableQty,
          }),
        );
      }
      dispatch(
        setStockAlert({
          kind: 'commit_failed',
          message: payload.reason,
          billId: payload.billId,
          batchId: payload.batchId,
        }),
      );
      dispatch(setLastEvent(WsEvent.STOCK_FAILED));
    });

    socket.on(WsEvent.BILL_COMPLETED, (payload: BillCompletedPayload) => {
      dispatch(setLastEvent(WsEvent.BILL_COMPLETED));
    });

    socket.on(WsEvent.BILL_CANCELLED, () => {
      dispatch(setLastEvent(WsEvent.BILL_CANCELLED));
      onBillListChangeRef.current?.();
    });

    socket.on(WsEvent.BILL_TRANSFERRED, () => {
      dispatch(setLastEvent(WsEvent.BILL_TRANSFERRED));
      onBillListChangeRef.current?.();
    });

    socket.on(WsEvent.QUEUE_STATUS_UPDATED, () => {
      dispatch(setLastEvent(WsEvent.QUEUE_STATUS_UPDATED));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      dispatch(setConnected(false));
    };
  }, [accessToken, counterId, dispatch]);

  return { socket: socketRef.current, connected };
}
