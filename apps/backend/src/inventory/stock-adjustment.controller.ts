import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../auth/types/auth-user.type';
import { StockAdjustmentService } from './stock-adjustment.service';
import { CreateStockAdjustmentDto } from './dto/stock-adjustment.dto';

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory')
export class StockAdjustmentController {
  constructor(private readonly adjustments: StockAdjustmentService) {}

  @Get('adjustments')
  @RequirePermissions('inventory.adjustment.view')
  list(
    @Query('batchId') batchId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adjustments.list({
      batchId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('adjustments')
  @RequirePermissions('inventory.adjustment.create')
  @ApiOperation({ summary: 'Adjust batch stock (creates immutable movement)' })
  create(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateStockAdjustmentDto,
    @Req() req: Request,
  ) {
    return this.adjustments.create(user.sub, dto, req.ip);
  }

  @Get('batches/:batchId/movements')
  @RequirePermissions('inventory.movement.view')
  movements(@Param('batchId') batchId: string, @Query('limit') limit?: string) {
    return this.adjustments.listMovements(batchId, limit ? parseInt(limit, 10) : 50);
  }

}
