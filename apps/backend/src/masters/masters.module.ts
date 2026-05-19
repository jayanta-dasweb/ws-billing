import { Module } from '@nestjs/common';
import { AuditModule } from '../common/audit/audit.module';
import { CompanyController } from './company/company.controller';
import { CompanyService } from './company/company.service';
import { CounterController } from './counter/counter.controller';
import { CounterService } from './counter/counter.service';
import { CustomerController } from './customer/customer.controller';
import { CustomerService } from './customer/customer.service';
import { TaxController } from './tax/tax.controller';
import { TaxService } from './tax/tax.service';
import { ProductController } from './product/product.controller';
import { ProductService } from './product/product.service';
import { BatchController } from './batch/batch.controller';
import { BatchService } from './batch/batch.service';
import { UserMasterController } from './user/user.controller';
import { UserMasterService } from './user/user.service';
import { PaymentModeController } from './payment-mode/payment-mode.controller';
import { PaymentModeService } from './payment-mode/payment-mode.service';

@Module({
  imports: [AuditModule],
  controllers: [
    CompanyController,
    CounterController,
    CustomerController,
    TaxController,
    ProductController,
    BatchController,
    UserMasterController,
    PaymentModeController,
  ],
  providers: [
    CompanyService,
    CounterService,
    CustomerService,
    TaxService,
    ProductService,
    BatchService,
    UserMasterService,
    PaymentModeService,
  ],
})
export class MastersModule {}
