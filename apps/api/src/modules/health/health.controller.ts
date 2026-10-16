import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('health')
@Controller()
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Liveness/readiness probe (also usable by load balancers)' })
  async health(): Promise<Record<string, unknown>> {
    let database: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`select 1`;
      database = 'up';
    } catch {
      database = 'down';
    }
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      service: 'mehrwearing-api',
      version: process.env.npm_package_version ?? '1.0.0',
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      database,
      timestamp: new Date().toISOString(),
    };
  }
}
