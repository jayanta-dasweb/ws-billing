import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockAdjustmentReason } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateStockAdjustmentDto {
  @ApiProperty()
  @IsString()
  batchId!: string;

  @ApiProperty({ description: 'Positive = add stock, negative = remove' })
  @IsNumber()
  qtyDelta!: number;

  @ApiProperty({ enum: StockAdjustmentReason })
  @IsEnum(StockAdjustmentReason)
  reason!: StockAdjustmentReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
