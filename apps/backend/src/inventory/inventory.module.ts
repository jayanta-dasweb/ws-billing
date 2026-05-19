import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { StockMovementService } from './stock-movement.service';
import { StockAdjustmentService } from './stock-adjustment.service';
import { StockAdjustmentController } from './stock-adjustment.controller';

@Module({
  imports: [StockModule],
  controllers: [StockAdjustmentController],
  providers: [StockMovementService, StockAdjustmentService],
  exports: [StockMovementService, StockAdjustmentService],
})
export class InventoryModule {}
