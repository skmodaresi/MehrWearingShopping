import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { MockPaymentProvider } from './mock.provider';
import { PaymentsService } from './payments.service';
import { ZarinpalPaymentProvider } from './zarinpal.provider';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, MockPaymentProvider, ZarinpalPaymentProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
