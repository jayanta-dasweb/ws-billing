import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import {
  BillCompletedPayload,
  BillTransferredPayload,
  StockFailedPayload,
  StockPendingUpdatedPayload,
  WsEvent,
} from '@billing/shared';
import { AuthUserPayload } from '../auth/types/auth-user.type';

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true },
  namespace: '/billing',
})
export class BillingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(BillingGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.query?.token as string);

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await this.jwt.verifyAsync<AuthUserPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });

      const queryCounter = client.handshake.query.counterId as string | undefined;
      let counterId = payload.counterId ?? undefined;

      if (payload.role === UserRole.CASHIER) {
        if (!counterId) {
          client.disconnect(true);
          return;
        }
      } else if (queryCounter) {
        counterId = queryCounter;
      }

      client.data.userId = payload.sub;
      client.data.counterId = counterId;

      if (counterId) {
        client.join(`counter:${counterId}`);
        this.server.emit(WsEvent.COUNTER_ONLINE, { counterId, socketId: client.id });
      }
      client.join('stock');
      this.logger.debug(`Client connected: ${client.id} user=${payload.username}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const counterId = client.data.counterId as string | undefined;
    if (counterId) {
      this.server.emit(WsEvent.COUNTER_OFFLINE, { counterId, socketId: client.id });
    }
  }

  emitStockPendingUpdated(payload: StockPendingUpdatedPayload) {
    this.server.to('stock').emit(WsEvent.STOCK_PENDING_UPDATED, payload);
  }

  emitStockCommitted(payload: StockPendingUpdatedPayload) {
    this.server.to('stock').emit(WsEvent.STOCK_COMMITTED, payload);
  }

  emitStockFailed(payload: StockFailedPayload) {
    this.server.to('stock').emit(WsEvent.STOCK_FAILED, payload);
  }

  emitBillCompleted(payload: BillCompletedPayload) {
    this.server.emit(WsEvent.BILL_COMPLETED, payload);
    this.server.to(`counter:${payload.counterId}`).emit(WsEvent.BILL_COMPLETED, payload);
  }

  emitQueueStatus(stats: { waiting: number; active: number }) {
    this.server.emit(WsEvent.QUEUE_STATUS_UPDATED, stats);
  }

  emitBillCancelled(payload: { billId: string; counterId: string }) {
    this.server.emit(WsEvent.BILL_CANCELLED, payload);
    this.server.to(`counter:${payload.counterId}`).emit(WsEvent.BILL_CANCELLED, payload);
  }

  emitBillTransferred(payload: BillTransferredPayload) {
    this.server.emit(WsEvent.BILL_TRANSFERRED, payload);
    this.server.to(`counter:${payload.fromCounterId}`).emit(WsEvent.BILL_TRANSFERRED, payload);
    this.server.to(`counter:${payload.toCounterId}`).emit(WsEvent.BILL_TRANSFERRED, payload);
  }
}
