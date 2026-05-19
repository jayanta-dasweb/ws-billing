import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../../auth/types/auth-user.type';
import { MASTER_WRITE_ROLES } from '../common/master-roles';
import { PaginationQueryDto } from '../common/pagination.dto';
import { PaymentModeService } from './payment-mode.service';
import { CreatePaymentModeDto, UpdatePaymentModeDto } from './dto/payment-mode.dto';

@ApiTags('Masters - Payment Mode')
@ApiBearerAuth()
@Controller('masters/payment-modes')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class PaymentModeController {
  constructor(private readonly service: PaymentModeService) {}

  @Get()
  @RequirePermissions('master.payment_mode.view')
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(...MASTER_WRITE_ROLES)
  @RequirePermissions('master.payment_mode.create')
  create(
    @Body() dto: CreatePaymentModeDto,
    @CurrentUser() user: AuthUserPayload,
    @Req() req: Request,
  ) {
    return this.service.create(dto, user.sub, req.ip);
  }

  @Patch(':id')
  @Roles(...MASTER_WRITE_ROLES)
  @RequirePermissions('master.payment_mode.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentModeDto,
    @CurrentUser() user: AuthUserPayload,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, user.sub, req.ip);
  }
}
