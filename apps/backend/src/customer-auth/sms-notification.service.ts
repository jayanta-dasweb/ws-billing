import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsNotificationService {
  private readonly logger = new Logger(SmsNotificationService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Sends OTP SMS. Default provider logs to server console (development / until SMS API is wired).
   */
  async sendOtp(mobile: string, code: string, purpose: string): Promise<void> {
    const provider = this.config.get<string>('SMS_PROVIDER', 'console').toLowerCase();

    if (provider === 'console') {
      this.logger.log(
        `[SMS:${purpose}] OTP for ${mobile}: ${code} (configure SMS_PROVIDER for production)`,
      );
      return;
    }

    // Hook for MSG91, Twilio, etc.
    this.logger.warn(`SMS_PROVIDER=${provider} is not implemented; OTP not sent to ${mobile}`);
    throw new Error('SMS delivery is not configured. Contact the store for help.');
  }
}
