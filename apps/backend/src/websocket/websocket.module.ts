import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingGateway } from './billing.gateway';

@Module({
  imports: [AuthModule],
  providers: [BillingGateway],
  exports: [BillingGateway],
})
export class WebsocketModule {}
