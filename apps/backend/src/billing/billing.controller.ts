import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../auth/types/auth-user.type';
import { BillingService } from './billing.service';
import {
  AddProductLineDto,
  CompleteBillDto,
  CreateBillDto,
  ScanLineDto,
  SetBillCustomerDto,
  SetBillDiscountDto,
  SetBillRoundOffDto,
  TransferBillDto,
  LineShortageAlertDto,
  UpdateLineDto,
} from './dto/billing.dto';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('catalog/search')
  @RequirePermissions('billing.counter.access')
  @ApiOperation({ summary: 'Search products by name, barcode, SKU, or batch number' })
  searchCatalog(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.billing.searchCatalog(q ?? '', limit ? parseInt(limit, 10) : 20);
  }

  @Get('batches/:batchId/holds')
  @RequirePermissions('billing.counter.access')
  @ApiOperation({ summary: 'Reserved qty on a batch by counter (open bills)' })
  batchHolds(@Param('batchId') batchId: string) {
    return this.billing.getBatchStockHolds(batchId);
  }

  @Post('bills')
  @RequirePermissions('billing.bill.create')
  @ApiOperation({ summary: 'Start a new draft bill' })
  create(@CurrentUser() user: AuthUserPayload, @Body() dto: CreateBillDto) {
    return this.billing.createDraft(user, dto);
  }

  @Get('bills/open')
  @RequirePermissions('billing.counter.access')
  @ApiOperation({ summary: "Today's draft and parked bills for counter tabs (workspace only)" })
  listOpen(@CurrentUser() user: AuthUserPayload, @Query('counterId') counterId?: string) {
    return this.billing.listOpenBills(user, counterId);
  }

  @Get('counters/online')
  @RequirePermissions('billing.counter.access')
  @ApiOperation({ summary: 'Counters with an active cashier session (for bill transfer)' })
  listOnlineCounters(
    @CurrentUser() user: AuthUserPayload,
    @Query('counterId') counterId?: string,
  ) {
    return this.billing.listTransferTargets(user, counterId);
  }

  @Post('bills/cleanup-empty')
  @RequirePermissions('billing.bill.create')
  @ApiOperation({ summary: 'Cancel all empty draft bills (EOD / tab cleanup)' })
  cleanupEmpty(
    @CurrentUser() user: AuthUserPayload,
    @Query('counterId') counterId?: string,
    @Query('keepBillId') keepBillId?: string,
  ) {
    return this.billing.cleanupEmptyDrafts(user, counterId, keepBillId);
  }

  @Get('bills/:id')
  @RequirePermissions('billing.counter.access')
  get(@Param('id') id: string, @CurrentUser() user: AuthUserPayload) {
    return this.billing.getBill(id, user);
  }

  @Post('bills/:id/lines')
  @RequirePermissions('billing.bill.create')
  @ApiOperation({ summary: 'Add product line (pick batch or FIFO)' })
  addLine(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: AddProductLineDto,
  ) {
    return this.billing.addProductLine(id, user, dto);
  }

  @Post('bills/:id/scan')
  @RequirePermissions('billing.bill.create')
  scan(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: ScanLineDto,
  ) {
    return this.billing.scanLine(id, user, dto);
  }

  @Patch('bills/:id/lines/:lineId')
  @RequirePermissions('billing.bill.create')
  updateLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: UpdateLineDto,
  ) {
    return this.billing.updateLine(id, lineId, user, dto);
  }

  @Post('bills/:id/lines/:lineId/shortage-alert')
  @RequirePermissions('billing.counter.access')
  @ApiOperation({ summary: 'Broadcast stock shortage to all counters (WebSocket)' })
  shortageAlert(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: LineShortageAlertDto,
  ) {
    return this.billing.publishLineShortageAlert(id, lineId, user, dto.attemptedQty);
  }

  @Patch('bills/:id/customer')
  @RequirePermissions('billing.bill.create')
  setCustomer(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: SetBillCustomerDto,
  ) {
    return this.billing.setBillCustomer(id, user, dto);
  }

  @Delete('bills/:id/lines/:lineId')
  @RequirePermissions('billing.bill.create')
  removeLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.billing.removeLine(id, lineId, user);
  }

  @Post('bills/:id/transfer')
  @RequirePermissions('billing.bill.hold')
  @ApiOperation({ summary: 'Send bill to another online counter' })
  transfer(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: TransferBillDto,
  ) {
    return this.billing.transferBill(id, user, dto);
  }

  @Post('bills/:id/hold')
  @RequirePermissions('billing.bill.hold')
  hold(@Param('id') id: string, @CurrentUser() user: AuthUserPayload) {
    return this.billing.holdBill(id, user);
  }

  @Post('bills/:id/resume')
  @RequirePermissions('billing.bill.hold')
  resume(@Param('id') id: string, @CurrentUser() user: AuthUserPayload) {
    return this.billing.resumeBill(id, user);
  }

  @Post('bills/:id/cancel')
  @RequirePermissions('billing.bill.create')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUserPayload) {
    return this.billing.cancelBill(id, user);
  }

  @Patch('bills/:id/discount')
  @RequirePermissions('billing.bill.create')
  setDiscount(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: SetBillDiscountDto,
  ) {
    return this.billing.setBillDiscount(id, user, dto);
  }

  @Patch('bills/:id/round-off')
  @RequirePermissions('billing.bill.create')
  @ApiOperation({ summary: 'Optional round-off: exact amount (UPI) or nearest ₹ (cash)' })
  setRoundOff(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: SetBillRoundOffDto,
  ) {
    return this.billing.setBillRoundOff(id, user, dto);
  }

  @Post('bills/:id/heartbeat')
  @RequirePermissions('billing.counter.access')
  @ApiOperation({ summary: 'Keep cart reservation alive (extends inactivity timeout)' })
  heartbeat(@Param('id') id: string, @CurrentUser() user: AuthUserPayload) {
    return this.billing.heartbeatBill(id, user);
  }

  @Post('bills/:id/complete')
  @RequirePermissions('billing.bill.complete')
  complete(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CompleteBillDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.billing.completeBill(id, user, dto, idempotencyKey);
  }
}
