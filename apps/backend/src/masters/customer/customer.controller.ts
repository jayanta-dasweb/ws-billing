import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../../auth/types/auth-user.type';
import { PaginationQueryDto } from '../common/pagination.dto';
import { CustomerService } from './customer.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@ApiTags('Masters - Customer')
@ApiBearerAuth()
@Controller('masters/customers')
export class CustomerController {
  constructor(private readonly service: CustomerService) {}

  @Get()
  @RequirePermissions('master.customer.view')
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('master.customer.view')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('master.customer.create')
  create(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() user: AuthUserPayload,
    @Req() req: Request,
  ) {
    return this.service.create(dto, user.sub, req.ip);
  }

  @Patch(':id')
  @RequirePermissions('master.customer.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: AuthUserPayload,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, user.sub, req.ip);
  }
}
