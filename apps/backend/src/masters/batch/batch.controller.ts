import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Request } from 'express';
import { IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../../auth/types/auth-user.type';
import { PaginationQueryDto } from '../common/pagination.dto';
import { BatchService } from './batch.service';
import { CreateBatchDto, UpdateBatchDto } from './dto/batch.dto';

class BatchListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  productId?: string;
}

@ApiTags('Masters - Batch')
@ApiBearerAuth()
@Controller('masters/batches')
export class BatchController {
  constructor(private readonly service: BatchService) {}

  @Get()
  @RequirePermissions('master.batch.view')
  @ApiQuery({ name: 'productId', required: false })
  findAll(@Query() query: BatchListQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('master.batch.view')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('master.batch.create')
  create(
    @Body() dto: CreateBatchDto,
    @CurrentUser() user: AuthUserPayload,
    @Req() req: Request,
  ) {
    return this.service.create(dto, user.sub, req.ip);
  }

  @Patch(':id')
  @RequirePermissions('master.batch.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBatchDto,
    @Req() req: Request,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.service.update(id, dto, user.sub, req.ip);
  }
}
