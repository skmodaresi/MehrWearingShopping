import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import {
  AuthedRequest,
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/jwt-auth.guard';
import { OrderStatus } from '../../generated/prisma/client';
import { PaymentsService } from '../payments/payments.service';
import { CreatePaymentDto, OrderStatusDto, PlaceOrderDto } from './dto';
import { OrdersService } from './orders.service';
import { resolveLocale } from '../../common/utils/locale';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Place an order from the cart (stock is reserved atomically)',
  })
  place(
    @CurrentUser() user: JwtPayload,
    @Req() request: AuthedRequest,
    @Body() dto: PlaceOrderDto,
  ) {
    return this.orders.place(user.sub, dto, resolveLocale(request));
  }

  @Get()
  @ApiOperation({ summary: 'My orders' })
  listMine(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.orders.listMine(user.sub, { page: Number(page) || 1, limit: Number(limit) || 10 });
  }

  @Get(':orderNumber')
  @ApiOperation({ summary: 'Order detail with tracking timeline' })
  getOne(@CurrentUser() user: JwtPayload, @Param('orderNumber') orderNumber: string) {
    return this.orders.getOne(orderNumber, user);
  }

  @Post(':orderNumber/cancel')
  @ApiOperation({ summary: 'Cancel my unpaid order (restores stock)' })
  cancel(@CurrentUser() user: JwtPayload, @Param('orderNumber') orderNumber: string) {
    return this.orders.cancel(orderNumber, user);
  }

  @Post(':orderNumber/pay')
  @ApiOperation({ summary: 'Start a payment and get the gateway redirect URL' })
  pay(
    @CurrentUser() user: JwtPayload,
    @Param('orderNumber') orderNumber: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.payments.createPayment(user, orderNumber, dto.provider);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@UseGuards(RolesGuard)
@Controller('admin')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('orders')
  @ApiOperation({ summary: 'All orders (filter by status)' })
  list(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.orders.listAll({
      status: status as OrderStatus | undefined,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Order detail' })
  getOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.orders.getOne(id, user);
  }

  @Post('orders/:id/status')
  @ApiOperation({ summary: 'Advance order status through the state machine' })
  setStatus(@Param('id') id: string, @Body() dto: OrderStatusDto) {
    return this.orders.setStatus(id, dto.status);
  }

  @Post('orders/:id/cancel')
  @ApiOperation({ summary: 'Cancel/refund an order (restores stock for unshipped orders)' })
  cancel(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.orders.cancel(id, user);
  }
}
