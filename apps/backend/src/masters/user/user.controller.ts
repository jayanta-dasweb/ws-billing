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
import { UserMasterService } from './user.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@ApiTags('Masters - User')
@ApiBearerAuth()
@Controller('masters/users')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class UserMasterController {
  constructor(private readonly service: UserMasterService) {}

  @Get()
  @RequirePermissions('master.user.view')
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @RequirePermissions('master.user.create')
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: AuthUserPayload,
    @Req() req: Request,
  ) {
    return this.service.create(dto, user.sub, req.ip);
  }

  @Patch(':id')
  @Roles(...MASTER_WRITE_ROLES)
  @RequirePermissions('master.user.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUserPayload,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, user.sub, req.ip);
  }
}
