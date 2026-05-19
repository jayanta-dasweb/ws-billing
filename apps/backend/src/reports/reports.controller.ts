import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('day-summary')
  @RequirePermissions('reports.day.view')
  @ApiOperation({ summary: 'Today sales, returns, open bills (day-end snapshot)' })
  daySummary() {
    return this.reports.getDaySummary();
  }
}
