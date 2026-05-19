import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../auth/types/auth-user.type';
import { InvoiceService } from './invoice.service';

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoices: InvoiceService) {}

  @Get('bill/:billId')
  @RequirePermissions('billing.counter.access')
  @ApiOperation({ summary: 'Invoice details for print (A4 / thermal HTML)' })
  getByBill(@Param('billId') billId: string, @CurrentUser() user: AuthUserPayload) {
    return this.invoices.getByBillId(billId, user);
  }

  @Get('search')
  @RequirePermissions('billing.counter.access')
  @ApiOperation({ summary: 'Invoice details by invoice number' })
  search(@Query('invoiceNo') invoiceNo: string, @CurrentUser() user: AuthUserPayload) {
    return this.invoices.getByInvoiceNo(invoiceNo, user);
  }

  @Get('lookup')
  @RequirePermissions('billing.counter.access')
  @ApiOperation({
    summary: 'Find completed invoices by invoice no, customer name, or mobile',
  })
  lookup(
    @Query('q') q: string,
    @Query('counterId') counterId: string | undefined,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.invoices.lookupCompleted(q ?? '', user, counterId);
  }

  @Get('bill/:billId/pdf')
  @RequirePermissions('billing.counter.access')
  @ApiOperation({ summary: 'Download GST invoice PDF (A4)' })
  async downloadPdf(
    @Param('billId') billId: string,
    @Query('format') format: 'a4' | 'thermal' = 'a4',
    @CurrentUser() user: AuthUserPayload,
    @Res() res: Response,
  ) {
    const buffer = await this.invoices.ensurePdf(billId, user, format);
    const detail = await this.invoices.getByBillId(billId, user);
    const filename = `${detail.invoiceNo.replace(/\//g, '-')}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    });
    res.send(buffer);
  }
}
