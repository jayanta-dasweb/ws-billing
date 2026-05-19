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
import { TaxService } from './tax.service';
import { CreateTaxDto, UpdateTaxDto } from './dto/tax.dto';

@ApiTags('Masters - Tax')
@ApiBearerAuth()
@Controller('masters/taxes')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class TaxController {
  constructor(private readonly service: TaxService) {}

  @Get()
  @RequirePermissions('master.tax.view')
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(...MASTER_WRITE_ROLES)
  @RequirePermissions('master.tax.create')
  create(
    @Body() dto: CreateTaxDto,
    @CurrentUser() user: AuthUserPayload,
    @Req() req: Request,
  ) {
    return this.service.create(dto, user.sub, req.ip);
  }

  @Patch(':id')
  @Roles(...MASTER_WRITE_ROLES)
  @RequirePermissions('master.tax.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaxDto,
    @CurrentUser() user: AuthUserPayload,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, user.sub, req.ip);
  }
}
