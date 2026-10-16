import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/jwt-auth.guard';
import { CatalogService } from './catalog.service';
import {
  AdminBrandDto,
  AdminCategoryDto,
  AdminProductDto,
  AdminVariantDto,
  AdminVariantStockDto,
} from './dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@UseGuards(RolesGuard)
@Controller('admin')
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  // --- products -----------------------------------------------------------

  @Get('products')
  @ApiOperation({ summary: 'All products for management (any status, with per-variant stock)' })
  listProducts(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.catalog.adminListProducts({
      q,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Post('products')
  @ApiOperation({ summary: 'Create a product with variants and specs' })
  createProduct(@Body() dto: AdminProductDto) {
    return this.catalog.createProduct(dto);
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Update product fields (price, status, translation, …)' })
  updateProduct(@Param('id') id: string, @Body() dto: Partial<AdminProductDto>) {
    return this.catalog.updateProduct(id, dto);
  }

  @Post('products/:id/variants')
  @ApiOperation({ summary: 'Add a variant (size/color/SKU/stock)' })
  addVariant(@Param('id') id: string, @Body() dto: AdminVariantDto) {
    return this.catalog.addVariant(id, dto);
  }

  @Patch('products/:id/variants/:variantId')
  @ApiOperation({ summary: 'Set absolute stock for a variant (records an inventory movement)' })
  setStock(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() dto: AdminVariantStockDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.catalog.setVariantStock(id, variantId, dto.stock, user.sub);
  }

  // --- categories & brands ------------------------------------------------

  @Post('categories')
  @ApiOperation({ summary: 'Create a category' })
  createCategory(@Body() dto: AdminCategoryDto) {
    return this.catalog.upsertCategory(null, dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update a category' })
  updateCategory(@Param('id') id: string, @Body() dto: AdminCategoryDto) {
    return this.catalog.upsertCategory(id, dto);
  }

  @Post('brands')
  @ApiOperation({ summary: 'Create a brand' })
  createBrand(@Body() dto: AdminBrandDto) {
    return this.catalog.upsertBrand(null, dto);
  }

  @Patch('brands/:id')
  @ApiOperation({ summary: 'Update a brand' })
  updateBrand(@Param('id') id: string, @Body() dto: AdminBrandDto) {
    return this.catalog.upsertBrand(id, dto);
  }
}
