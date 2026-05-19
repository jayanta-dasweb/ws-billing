import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../../auth/types/auth-user.type';
import { MASTER_WRITE_ROLES } from '../common/master-roles';
import { PaginationQueryDto } from '../common/pagination.dto';
import { CompanyService } from './company.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';

@ApiTags('Masters - Company')
@ApiBearerAuth()
@Controller('masters/companies')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class CompanyController {
  constructor(private readonly service: CompanyService) {}

  @Get()
  @RequirePermissions('master.company.view')
  @ApiOperation({ summary: 'List companies' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get company by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(...MASTER_WRITE_ROLES)
  @RequirePermissions('master.company.create')
  @ApiOperation({ summary: 'Create company' })
  create(
    @Body() dto: CreateCompanyDto,
    @CurrentUser() user: AuthUserPayload,
    @Req() req: Request,
  ) {
    return this.service.create(dto, user.sub, req.ip);
  }

  @Patch(':id')
  @Roles(...MASTER_WRITE_ROLES)
  @RequirePermissions('master.company.update')
  @ApiOperation({ summary: 'Update company' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() user: AuthUserPayload,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, user.sub, req.ip);
  }
}
