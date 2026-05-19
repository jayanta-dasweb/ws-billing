import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMode } from '@prisma/client';
import type { PaymentAuditDetails } from '@billing/shared';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class PaymentAuditDto implements PaymentAuditDetails {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  upiTxnId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  upiApp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  upiPayerVpa?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  upiTxnAt?: string;

  @ApiPropertyOptional({ enum: ['CREDIT', 'DEBIT'] })
  @IsOptional()
  @IsIn(['CREDIT', 'DEBIT'])
  cardType?: 'CREDIT' | 'DEBIT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cardBank?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cardLast4?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cardApprovalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cardRrn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cardNetwork?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cardTerminalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chequeNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chequeBank?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chequeBranch?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chequeDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chequeDrawer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ddNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ddBank?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ddBranch?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ddDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  creditTerms?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  creditDueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  creditPoRef?: string;
}

export class CreateBillDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  counterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;
}

export class TransferBillDto {
  @ApiProperty({ description: 'Destination counter (must be online)' })
  @IsString()
  @MinLength(1)
  targetCounterId!: string;
}

export class AddProductLineDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  productId!: string;

  @ApiPropertyOptional({ description: 'Pick batch; FIFO by expiry if omitted' })
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qty?: number;
}

export class ScanLineDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  barcode!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qty?: number;
}

export class UpdateLineQtyDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qty!: number;
}

export class LineShortageAlertDto {
  @ApiProperty({ description: 'Qty the cashier tried to sell on this line' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  attemptedQty!: number;
}

export class UpdateLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ description: 'Percent off line gross (0–100)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountPercent?: number;
}

export class SetBillCustomerDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  customerId!: string;
}

export class SetBillDiscountDto {
  @ApiPropertyOptional({ description: 'Bill-level discount in ₹ (after line discounts)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ description: 'Bill-level discount as % of total before bill discount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  percent?: number;
}

export class SetBillRoundOffDto {
  @ApiProperty({
    enum: ['none', 'nearest'],
    description: 'none = exact paise (UPI/card); nearest = round to whole ₹ for cash',
  })
  @IsIn(['none', 'nearest'])
  mode!: 'none' | 'nearest';
}

export class PaymentSplitDto {
  @ApiProperty({
    enum: [
      PaymentMode.CASH,
      PaymentMode.CARD,
      PaymentMode.UPI,
      PaymentMode.CHEQUE,
      PaymentMode.DD,
      PaymentMode.CREDIT,
    ],
  })
  @IsEnum(PaymentMode)
  mode!: PaymentMode;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ description: 'Legacy reference string' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ type: PaymentAuditDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PaymentAuditDto)
  audit?: PaymentAuditDto;

  @ApiPropertyOptional({ description: 'Cash tendered for this cash split line' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cashTendered?: number;
}

export class CompleteBillDto {
  @ApiProperty({ enum: PaymentMode })
  @IsEnum(PaymentMode)
  paymentMode!: PaymentMode;

  @ApiPropertyOptional({ description: 'Total cash tendered (single cash or split cash total)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cashReceived?: number;

  @ApiPropertyOptional({ type: [PaymentSplitDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentSplitDto)
  splits?: PaymentSplitDto[];

  @ApiPropertyOptional({ type: PaymentAuditDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PaymentAuditDto)
  audit?: PaymentAuditDto;

  @ApiPropertyOptional({ description: 'Credit sale reference / due date note' })
  @IsOptional()
  @IsString()
  creditNote?: string;
}
