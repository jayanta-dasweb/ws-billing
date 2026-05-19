import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CustomerAuthController } from './customer-auth.controller';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerOtpService } from './customer-otp.service';
import { SmsNotificationService } from './sms-notification.service';
import { CustomerOnlyGuard } from '../auth/guards/customer-only.guard';
import { CustomerCsrfGuard } from '../auth/guards/customer-csrf.guard';
import { AuthModule } from '../auth/auth.module';
import { InvoiceModule } from '../invoice/invoice.module';

@Module({
  imports: [AuthModule, JwtModule, InvoiceModule],
  controllers: [CustomerAuthController],
  providers: [
    CustomerAuthService,
    CustomerOtpService,
    SmsNotificationService,
    CustomerOnlyGuard,
    CustomerCsrfGuard,
  ],
  exports: [CustomerAuthService],
})
export class CustomerAuthModule {}
