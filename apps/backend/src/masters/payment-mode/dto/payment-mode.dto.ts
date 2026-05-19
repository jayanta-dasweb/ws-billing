import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreatePaymentModeDto {
  @ApiProperty({ example: 'CASH' })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({ example: 'Cash' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePaymentModeDto extends PartialType(CreatePaymentModeDto) {}
