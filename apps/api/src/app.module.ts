import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard, RolesGuard } from './common/guards/jwt-auth.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthController } from './modules/health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { CartModule } from './modules/cart/cart.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { OrdersModule } from './modules/orders/orders.module';
import { StatsModule } from './modules/stats/stats.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    ReviewsModule,
    WishlistModule,
    CartModule,
    CouponsModule,
    PaymentsModule,
    OrdersModule,
    StatsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Authentication runs for every route; @Public/@OptionalAuth opt out.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Role checks activate only where @Roles() metadata exists.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
