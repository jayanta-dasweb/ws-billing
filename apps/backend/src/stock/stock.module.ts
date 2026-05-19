import { Module } from '@nestjs/common';
import { WebsocketModule } from '../websocket/websocket.module';
import { StockReservationService } from './stock-reservation.service';
import { StockEventsListener } from './stock-events.listener';
import { ReservationCleanupService } from './reservation-cleanup.service';

@Module({
  imports: [WebsocketModule],
  providers: [StockReservationService, StockEventsListener, ReservationCleanupService],
  exports: [StockReservationService],
})
export class StockModule {}
