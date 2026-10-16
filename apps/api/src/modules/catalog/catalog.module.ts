import { Module } from '@nestjs/common';
import { AdminCatalogController } from './admin.controller';
import { CatalogReadController, ProductsController } from './catalog.controllers';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [CatalogReadController, ProductsController, AdminCatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
