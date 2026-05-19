import { SetMetadata } from '@nestjs/common';

export const IS_CUSTOMER_ONLY_KEY = 'isCustomerOnly';
export const CustomerOnly = () => SetMetadata(IS_CUSTOMER_ONLY_KEY, true);
