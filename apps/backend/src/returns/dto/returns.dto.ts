import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMode, ReturnType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReturnLineDto {
  @IsString()
  billItemId!: string;

  @IsNumber()
  @Min(0.001)
  qty!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateReturnDto {
  @ApiProperty({ description: 'Completed bill id' })
  @IsString()
  billId!: string;

  @ApiProperty({ enum: ReturnType })
  @IsEnum(ReturnType)
  returnType!: ReturnType;

  @ApiProperty({ type: [ReturnLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  lines!: ReturnLineDto[];

  @ApiPropertyOptional({ enum: PaymentMode })
  @IsOptional()
  @IsEnum(PaymentMode)
  refundMode?: PaymentMode;

  @IsOptional()
  @IsString()
  refundNote?: string;
}

export class CompleteReturnDto {
  @ApiPropertyOptional({ enum: PaymentMode })
  @IsOptional()
  @IsEnum(PaymentMode)
  refundMode?: PaymentMode;

  @IsOptional()
  @IsString()
  refundNote?: string;
}
