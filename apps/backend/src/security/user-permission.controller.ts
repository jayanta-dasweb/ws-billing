import { Body, Controller, Get, Param, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../auth/types/auth-user.type';
import { PermissionService } from './permission.service';
import { SetUserPermissionsDto } from './dto/role.dto';

@ApiTags('RBAC - User permissions')
@ApiBearerAuth()
@Controller('rbac/users')
export class UserPermissionController {
  constructor(private readonly permissions: PermissionService) {}

  @Get(':userId/permissions')
  @RequirePermissions('master.user.view')
  @ApiOperation({ summary: 'Role permissions + user-only grants/revokes' })
  getUserPermissions(@Param('userId') userId: string) {
    return this.permissions.getUserPermissionDetail(userId);
  }

  @Put(':userId/permissions')
  @RequirePermissions('master.user.update')
  @ApiOperation({ summary: 'Set extra permissions for one user only' })
  setUserPermissions(
    @Param('userId') userId: string,
    @Body() dto: SetUserPermissionsDto,
    @CurrentUser() user: AuthUserPayload,
    @Req() req: Request,
  ) {
    return this.permissions.setUserPermissionOverrides(
      userId,
      dto.grants,
      dto.revokes,
      user.sub,
      req.ip,
    );
  }
}
