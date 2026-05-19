import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../auth/types/auth-user.type';
import { IpAllowlistService } from './ip-allowlist.service';

class CreateIpRuleDto {
  @IsString()
  cidr!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateIpRuleDto {
  @IsOptional()
  @IsString()
  cidr?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags('Security - IP')
@ApiBearerAuth()
@Controller('security')
export class SecurityController {
  constructor(private readonly ipService: IpAllowlistService) {}

  @Get('counters/:counterId/ip-rules')
  @RequirePermissions('security.ip.view')
  listIpRules(@Param('counterId') counterId: string) {
    return this.ipService.listByCounter(counterId);
  }

  @Post('counters/:counterId/ip-rules')
  @RequirePermissions('security.ip.manage')
  createIpRule(
    @Param('counterId') counterId: string,
    @Body() dto: CreateIpRuleDto,
    @CurrentUser() user: AuthUserPayload,
    @Req() req: Request,
  ) {
    return this.ipService.create(counterId, dto, user.sub, req.ip);
  }

  @Patch('ip-rules/:id')
  @RequirePermissions('security.ip.manage')
  updateIpRule(
    @Param('id') id: string,
    @Body() dto: UpdateIpRuleDto,
    @CurrentUser() user: AuthUserPayload,
    @Req() req: Request,
  ) {
    return this.ipService.update(id, dto, user.sub, req.ip);
  }

  @Get('ip-check')
  @ApiOperation({ summary: 'Check if client IP is allowed for a counter' })
  async ipCheck(@Query('counterId') counterId: string, @Req() req: Request) {
    const allowed = await this.ipService.isIpAllowedForCounter(counterId, req.ip);
    return { counterId, clientIp: req.ip, allowed, enforced: this.ipService.isEnforced() };
  }
}
