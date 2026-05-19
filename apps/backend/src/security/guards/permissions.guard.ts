import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRoleKey } from '@billing/shared';
import { UserRole } from '@prisma/client';
import { PERMISSIONS_KEY } from '../../common/decorators/require-permissions.decorator';
import { isStaffAuth, type JwtPayload } from '../../auth/types/auth-principal.type';
import { PermissionService } from '../permission.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const { user } = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    if (!user || !isStaffAuth(user)) throw new ForbiddenException('Insufficient permissions');

    if (
      user.roleKey === SystemRoleKey.SUPER_ADMIN ||
      user.role === UserRole.SUPER_ADMIN
    ) {
      return true;
    }

    const granted =
      user.permissions ?? (await this.permissions.getPermissionsForUser(user.sub));

    const missing = required.filter((p) => !granted.includes(p));
    if (missing.length) {
      throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
    }
    return true;
  }
}
