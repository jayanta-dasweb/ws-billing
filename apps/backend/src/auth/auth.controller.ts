import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CsrfGuard } from './guards/csrf.guard';
import { AuthUserPayload } from './types/auth-user.type';
import { REFRESH_COOKIE } from './auth.constants';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with username and password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      dto.username,
      dto.password,
      req.ip,
    );
    this.authService.setAuthCookies(res, result.refreshToken, result.csrfToken);
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!refreshToken) {
      throw new UnauthorizedException('Session expired. Please login again.');
    }
    const result = await this.authService.refresh(refreshToken, req.ip);
    this.authService.setAuthCookies(res, result.refreshToken, result.csrfToken);
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    await this.authService.logout(refreshToken, user.sub, req.ip);
    this.authService.clearAuthCookies(res);
    return { message: 'Logged out' };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current authenticated user profile' })
  async me(@CurrentUser() user: AuthUserPayload) {
    return this.authService.getProfile(user.sub, user.counterId);
  }

  @Get('session')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CASHIER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate session and return user + counter' })
  async session(@CurrentUser() user: AuthUserPayload) {
    const profile = await this.authService.getProfile(user.sub, user.counterId);
    return {
      active: true,
      user: profile,
    };
  }
}
