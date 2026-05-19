import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo() {
    return {
      name: 'Billing System API',
      version: '1.0.0',
      architecture: 'soft-reservation + FIFO commit queue',
    };
  }
}
