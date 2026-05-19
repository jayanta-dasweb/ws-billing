import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from '../common/audit/audit.module';
import { RedisModule } from '../redis/redis.module';
import { PermissionsGuard } from './guards/permissions.guard';
import { PermissionService } from './permission.service';
import { IpAllowlistService } from './ip-allowlist.service';
import { CounterSessionService } from './counter-session.service';
import { UserCounterService } from './user-counter.service';
import { SecurityController } from './security.controller';
import { RoleController } from './role.controller';
import { UserPermissionController } from './user-permission.controller';
import { RoleService } from './role.service';

@Global()
@Module({
  imports: [AuditModule, RedisModule],
  controllers: [SecurityController, RoleController, UserPermissionController],
  providers: [
    PermissionService,
    RoleService,
    IpAllowlistService,
    CounterSessionService,
    UserCounterService,
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [
    PermissionService,
    RoleService,
    IpAllowlistService,
    CounterSessionService,
    UserCounterService,
  ],
})
export class SecurityModule {}
