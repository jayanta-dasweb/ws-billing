import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateBatchDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  batchNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  mrp!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellingPrice!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stockQty?: number;

  @ApiPropertyOptional({
    description: 'Default % off line gross when sold from this batch',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @ApiPropertyOptional({
    description: 'Default ₹ discount per unit when sold from this batch',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountPerUnit?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBatchDto extends PartialType(CreateBatchDto) {}
