import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditContextInterceptor } from './common/audit/audit-context.interceptor';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { StaffOnlyGuard } from './auth/guards/staff-only.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { CustomerAuthModule } from './customer-auth/customer-auth.module';
import { AuditModule } from './common/audit/audit.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import { WebsocketModule } from './websocket/websocket.module';
import { HealthModule } from './health/health.module';
import { MastersModule } from './masters/masters.module';
import { BillingModule } from './billing/billing.module';
import { InvoiceModule } from './invoice/invoice.module';
import { SecurityModule } from './security/security.module';
import { StockModule } from './stock/stock.module';
import { ReturnsModule } from './returns/returns.module';
import { ReportsModule } from './reports/reports.module';
import { InventoryModule } from './inventory/inventory.module';
import { winstonConfig } from './common/logger/winston.config';
import { validateEnv } from './common/config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    WinstonModule.forRoot(winstonConfig),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
        },
      }),
    }),
    AuditModule,
    SecurityModule,
    AuthModule,
    CustomerAuthModule,
    PrismaModule,
    RedisModule,
    QueueModule,
    WebsocketModule,
    HealthModule,
    MastersModule,
    BillingModule,
    InvoiceModule,
    StockModule,
    InventoryModule,
    ReturnsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: AuditContextInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: StaffOnlyGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
