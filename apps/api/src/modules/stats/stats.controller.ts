import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { RolesGuard } from '../../common/guards/jwt-auth.guard';
import { StatsService } from './stats.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@UseGuards(RolesGuard)
@Controller('admin')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Dashboard KPIs: revenue, orders, top products, low stock' })
  dashboard() {
    return this.stats.dashboard();
  }
}
