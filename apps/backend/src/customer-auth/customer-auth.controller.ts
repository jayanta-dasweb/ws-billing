import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CustomerOnly } from '../common/decorators/customer-only.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CustomerOnlyGuard } from '../auth/guards/customer-only.guard';
import { CustomerCsrfGuard } from '../auth/guards/customer-csrf.guard';
import { CustomerAuthPayload } from '../auth/types/auth-principal.type';
import { CUSTOMER_REFRESH_COOKIE } from '../auth/auth.constants';
import { CustomerAuthService } from './customer-auth.service';
import {
  CustomerLoginDto,
  CustomerMobileDto,
  CustomerResetPasswordDto,
  CustomerSetPasswordDto,
} from './dto/customer-auth.dto';

@ApiTags('Customer portal')
@Controller('customer-auth')
export class CustomerAuthController {
  constructor(private readonly customerAuth: CustomerAuthService) {}

  @Public()
  @Post('lookup')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Check mobile — needs password or can sign in' })
  async lookup(@Body() dto: CustomerMobileDto) {
    return this.customerAuth.lookup(dto.mobile);
  }

  @Public()
  @Post('set-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'First-time password (customer only, not staff)' })
  async setPassword(
    @Body() dto: CustomerSetPasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.customerAuth.setPassword(dto.mobile, dto.password, req.ip);
    this.customerAuth.setCustomerAuthCookies(res, result.refreshToken, result.csrfToken);
    return { accessToken: result.accessToken, customer: result.customer };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Send OTP to registered mobile for password reset' })
  async forgotPassword(@Body() dto: CustomerMobileDto, @Req() req: Request) {
    return this.customerAuth.requestForgotPasswordOtp(dto.mobile, req.ip);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify OTP and set a new password' })
  async resetPassword(
    @Body() dto: CustomerResetPasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.customerAuth.resetPasswordWithOtp(
      dto.mobile,
      dto.otp,
      dto.password,
      req.ip,
    );
    this.customerAuth.setCustomerAuthCookies(res, result.refreshToken, result.csrfToken);
    return { accessToken: result.accessToken, customer: result.customer };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @ApiOperation({ summary: 'Customer sign in with mobile and password' })
  async login(
    @Body() dto: CustomerLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.customerAuth.login(dto.mobile, dto.password, req.ip);
    this.customerAuth.setCustomerAuthCookies(res, result.refreshToken, result.csrfToken);
    return { accessToken: result.accessToken, customer: result.customer };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @UseGuards(CustomerCsrfGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Refresh customer session' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[CUSTOMER_REFRESH_COOKIE] as string | undefined;
    if (!refreshToken) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }
    const result = await this.customerAuth.refresh(refreshToken, req.ip);
    this.customerAuth.setCustomerAuthCookies(res, result.refreshToken, result.csrfToken);
    return { accessToken: result.accessToken, customer: result.customer };
  }

  @CustomerOnly()
  @Post('logout')
  @HttpCode(200)
  @UseGuards(CustomerOnlyGuard, CustomerCsrfGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Customer logout' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: CustomerAuthPayload,
  ) {
    const refreshToken = req.cookies?.[CUSTOMER_REFRESH_COOKIE] as string | undefined;
    await this.customerAuth.logout(refreshToken, user.sub, req.ip);
    this.customerAuth.clearCustomerAuthCookies(res);
    return { message: 'Logged out' };
  }

  @CustomerOnly()
  @Get('me')
  @UseGuards(CustomerOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current customer profile' })
  async me(@CurrentUser() user: CustomerAuthPayload) {
    return this.customerAuth.getProfile(user.sub);
  }

  @CustomerOnly()
  @Get('dashboard')
  @UseGuards(CustomerOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Purchase analytics and summary' })
  async dashboard(@CurrentUser() user: CustomerAuthPayload) {
    return this.customerAuth.getDashboard(user.sub);
  }

  @CustomerOnly()
  @Get('bills')
  @UseGuards(CustomerOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'All completed invoices' })
  async bills(@CurrentUser() user: CustomerAuthPayload) {
    return this.customerAuth.listBills(user.sub);
  }

  @CustomerOnly()
  @Get('bills/:billId')
  @UseGuards(CustomerOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Full invoice detail for a bill' })
  async billDetail(
    @Param('billId') billId: string,
    @CurrentUser() user: CustomerAuthPayload,
  ) {
    return this.customerAuth.getBillDetail(user.sub, billId);
  }

  @CustomerOnly()
  @Get('bills/:billId/pdf')
  @UseGuards(CustomerOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download invoice PDF' })
  async billPdf(
    @Param('billId') billId: string,
    @Query('format') format: 'a4' | 'thermal' = 'a4',
    @CurrentUser() user: CustomerAuthPayload,
    @Res() res: Response,
  ) {
    const buffer = await this.customerAuth.ensureBillPdf(user.sub, billId, format);
    const detail = await this.customerAuth.getBillDetail(user.sub, billId);
    const filename = `${detail.invoiceNo.replace(/\//g, '-')}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    });
    res.send(buffer);
  }
}
