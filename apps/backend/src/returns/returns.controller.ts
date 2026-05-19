import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../auth/types/auth-user.type';
import { ReturnsService } from './returns.service';
import { CompleteReturnDto, CreateReturnDto } from './dto/returns.dto';

@ApiTags('Returns')
@ApiBearerAuth()
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get('lookup')
  @RequirePermissions('inventory.return.view')
  @ApiOperation({ summary: 'Lookup completed bill for return' })
  lookup(
    @Query('invoiceNo') invoiceNo?: string,
    @Query('billId') billId?: string,
  ) {
    return this.returns.lookupBill(invoiceNo, billId);
  }

  @Get()
  @RequirePermissions('inventory.return.view')
  list() {
    return this.returns.listReturns();
  }

  @Get(':id')
  @RequirePermissions('inventory.return.view')
  get(@Param('id') id: string) {
    return this.returns.getReturn(id);
  }

  @Post()
  @RequirePermissions('inventory.return.create')
  create(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateReturnDto,
    @Req() req: Request,
  ) {
    return this.returns.createReturn(user, dto, req.ip);
  }

  @Post(':id/complete')
  @RequirePermissions('inventory.return.create')
  complete(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CompleteReturnDto,
    @Req() req: Request,
  ) {
    return this.returns.completeReturn(id, user, dto, req.ip);
  }

  @Post(':id/cancel')
  @RequirePermissions('inventory.return.create')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUserPayload, @Req() req: Request) {
    return this.returns.cancelReturn(id, user, req.ip);
  }
}
