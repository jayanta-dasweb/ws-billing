import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../auth/types/auth-user.type';
import { PaginationQueryDto } from '../masters/common/pagination.dto';
import { PermissionService } from './permission.service';
import { RoleService } from './role.service';
import { CreateRoleDto, SetRolePermissionsDto, UpdateRoleDto } from './dto/role.dto';

@ApiTags('RBAC - Roles')
@ApiBearerAuth()
@Controller('rbac')
export class RoleController {
  constructor(
    private readonly roles: RoleService,
    private readonly permissions: PermissionService,
  ) {}

  @Get('permissions/catalog')
  @RequirePermissions('security.permission.view')
  @ApiOperation({ summary: 'All permissions grouped (Spatie-style)' })
  getCatalog() {
    return this.permissions.getCatalog();
  }

  @Get('roles')
  @RequirePermissions('master.role.view')
  listRoles(@Query() query: PaginationQueryDto) {
    return this.roles.findAll(query);
  }

  @Get('roles/:id')
  @RequirePermissions('master.role.view')
  getRole(@Param('id') id: string) {
    return this.roles.findOne(id);
  }

  @Post('roles')
  @RequirePermissions('master.role.create')
  createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: AuthUserPayload,
    @Req() req: Request,
  ) {
    return this.roles.create(dto, user.sub, req.ip);
  }

  @Patch('roles/:id')
  @RequirePermissions('master.role.update')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthUserPayload,
    @Req() req: Request,
  ) {
    return this.roles.update(id, dto, user.sub, req.ip);
  }

  @Put('roles/:id/permissions')
  @RequirePermissions('security.permission.manage')
  setRolePermissions(
    @Param('id') id: string,
    @Body() dto: SetRolePermissionsDto,
    @CurrentUser() user: AuthUserPayload,
    @Req() req: Request,
  ) {
    return this.roles.setPermissions(id, dto.permissionCodes, user.sub, req.ip);
  }
}
