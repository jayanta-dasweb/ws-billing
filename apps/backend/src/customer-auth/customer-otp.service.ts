import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SmsNotificationService } from './sms-notification.service';

export const CUSTOMER_OTP_PURPOSE_PASSWORD_RESET = 'PASSWORD_RESET';

const OTP_LENGTH = 6;
const MAX_VERIFY_ATTEMPTS = 5;

@Injectable()
export class CustomerOtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly sms: SmsNotificationService,
  ) {}

  private otpExpiryMinutes(): number {
    return Number(this.config.get<string>('CUSTOMER_OTP_EXPIRY_MINUTES', '10')) || 10;
  }

  private requestCooldownMinutes(): number {
    return Number(this.config.get<string>('CUSTOMER_OTP_REQUEST_COOLDOWN_MINUTES', '15')) || 15;
  }

  private maxRequestsPerWindow(): number {
    return Number(this.config.get<string>('CUSTOMER_OTP_MAX_REQUESTS_PER_WINDOW', '3')) || 3;
  }

  private hashCode(code: string): string {
    const secret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    return createHash('sha256').update(`customer-otp:${code}:${secret}`).digest('hex');
  }

  private generateCode(): string {
    return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
  }

  private exposeDevOtp(): boolean {
    return (
      this.config.get<string>('NODE_ENV', 'development') === 'development' &&
      this.config.get<string>('CUSTOMER_OTP_DEV_EXPOSE', 'true') === 'true'
    );
  }

  async sendPasswordResetOtp(
    customerId: string,
    mobile: string,
  ): Promise<{ expiresInSeconds: number; devOtp?: string }> {
    const since = new Date(Date.now() - this.requestCooldownMinutes() * 60 * 1000);
    const recentCount = await this.prisma.customerOtpChallenge.count({
      where: {
        customerId,
        purpose: CUSTOMER_OTP_PURPOSE_PASSWORD_RESET,
        createdAt: { gte: since },
      },
    });

    if (recentCount >= this.maxRequestsPerWindow()) {
      throw new HttpException(
        'Too many OTP requests. Please wait a few minutes and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.prisma.customerOtpChallenge.deleteMany({
      where: {
        customerId,
        purpose: CUSTOMER_OTP_PURPOSE_PASSWORD_RESET,
        verifiedAt: null,
      },
    });

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + this.otpExpiryMinutes() * 60 * 1000);

    await this.prisma.customerOtpChallenge.create({
      data: {
        customerId,
        mobile,
        purpose: CUSTOMER_OTP_PURPOSE_PASSWORD_RESET,
        codeHash: this.hashCode(code),
        expiresAt,
      },
    });

    await this.sms.sendOtp(mobile, code, CUSTOMER_OTP_PURPOSE_PASSWORD_RESET);

    const result: { expiresInSeconds: number; devOtp?: string } = {
      expiresInSeconds: this.otpExpiryMinutes() * 60,
    };
    if (this.exposeDevOtp()) {
      result.devOtp = code;
    }
    return result;
  }

  async verifyPasswordResetOtp(customerId: string, otp: string): Promise<void> {
    const normalizedOtp = otp.replace(/\D/g, '');
    if (normalizedOtp.length !== OTP_LENGTH) {
      throw new BadRequestException('Enter the 6-digit code from your mobile');
    }

    const challenge = await this.prisma.customerOtpChallenge.findFirst({
      where: {
        customerId,
        purpose: CUSTOMER_OTP_PURPOSE_PASSWORD_RESET,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new BadRequestException('OTP expired or not found. Request a new code.');
    }

    if (challenge.attempts >= MAX_VERIFY_ATTEMPTS) {
      throw new HttpException(
        'Too many wrong attempts. Request a new OTP.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const expected = Buffer.from(challenge.codeHash, 'hex');
    const actual = Buffer.from(this.hashCode(normalizedOtp), 'hex');
    const valid =
      expected.length === actual.length && timingSafeEqual(expected, actual);

    if (!valid) {
      await this.prisma.customerOtpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid OTP. Please check and try again.');
    }

    await this.prisma.customerOtpChallenge.update({
      where: { id: challenge.id },
      data: { verifiedAt: new Date() },
    });
  }
}
