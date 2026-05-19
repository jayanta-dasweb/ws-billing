import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'store_manager' })
  @IsString()
  @MinLength(2)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'Key must be lowercase letters, numbers, underscores (e.g. store_manager)',
  })
  key!: string;

  @ApiProperty({ example: 'Store Manager' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionCodes?: string[];
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  key?: string;
}

export class SetRolePermissionsDto {
  @ApiProperty({ type: [String], example: ['master.user.view', 'billing.counter.access'] })
  @IsArray()
  @IsString({ each: true })
  permissionCodes!: string[];
}

export class SetUserPermissionsDto {
  @ApiProperty({ type: [String], description: 'Extra permissions granted only to this user' })
  @IsArray()
  @IsString({ each: true })
  grants!: string[];

  @ApiProperty({
    type: [String],
    description: 'Permissions removed from this user even if their role has them',
  })
  @IsArray()
  @IsString({ each: true })
  revokes!: string[];
}
