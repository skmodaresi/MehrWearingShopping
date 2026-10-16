import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../../common/decorators/auth.decorators';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('mock/checkout')
  @Public()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: 'Development-only fake gateway page' })
  @ApiQuery({ name: 'order' })
  @ApiQuery({ name: 'amount' })
  @ApiQuery({ name: 'sig' })
  gatewayPage(
    @Query('order') order: string,
    @Query('amount') amount: string,
    @Query('sig') sig: string,
  ): Promise<string> {
    return this.payments.mockGatewayPage(
      String(order ?? ''),
      Number(amount ?? 0),
      String(sig ?? ''),
    );
  }

  @Get('mock/callback')
  @Public()
  @ApiOperation({ summary: 'Mock gateway callback → redirects to the order page' })
  async mockCallback(
    @Res() res: Response,
    @Query('order') order: string,
    @Query('amount') amount: string,
    @Query('sig') sig: string,
    @Query('result') result?: string,
  ): Promise<void> {
    const url = await this.payments.handleMockCallback({
      orderNumber: String(order ?? ''),
      amountToman: Number(amount ?? 0),
      signature: String(sig ?? ''),
      result: result ?? undefined,
    });
    res.redirect(302, url);
  }

  @Get('zarinpal/callback')
  @Public()
  @ApiOperation({ summary: 'Zarinpal gateway callback (configure as the merchant callback URL)' })
  async zarinpalCallback(
    @Res() res: Response,
    @Query('Authority') authority: string,
    @Query('Status') status?: string,
  ): Promise<void> {
    const url = await this.payments.handleZarinpalCallback(
      String(authority ?? ''),
      status ?? undefined,
    );
    res.redirect(302, url);
  }
}
