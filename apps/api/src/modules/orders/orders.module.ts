import { Module } from '@nestjs/common';
import { CouponsModule } from '../coupons/coupons.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdminOrdersController, OrdersController } from './orders.controllers';
import { OrdersService } from './orders.service';

@Module({
  imports: [CouponsModule, PaymentsModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
