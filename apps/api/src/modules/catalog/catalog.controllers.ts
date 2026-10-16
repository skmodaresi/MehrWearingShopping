import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/auth.decorators';
import { CatalogService } from './catalog.service';
import { ProductListQueryDto } from './dto';

@ApiTags('catalog')
@Public()
@Controller()
export class CatalogReadController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  @ApiOperation({ summary: 'Active categories with product counts' })
  categories() {
    return this.catalog.categories();
  }

  @Get('categories/:slug')
  @ApiOperation({ summary: 'Single category with its children' })
  category(@Param('slug') slug: string) {
    return this.catalog.category(slug);
  }

  @Get('brands')
  @ApiOperation({ summary: 'Brands with product counts' })
  brands() {
    return this.catalog.brands();
  }
}

@ApiTags('products')
@Public()
@Controller('products')
export class ProductsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOperation({
    summary: 'List products with filtering, search, sorting and pagination',
    description:
      'Filters: category, brand, q (Persian/English search), minPrice/maxPrice, sizes, colors, inStock, discount, featured.',
  })
  list(@Query() query: ProductListQueryDto) {
    return this.catalog.listProducts(query);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Featured products for the home page' })
  featured() {
    return this.catalog.featuredProducts(8);
  }

  @Get('deals')
  @ApiOperation({ summary: 'Discounted products for the deals row' })
  deals() {
    return this.catalog.deals(8);
  }

  @Get('facets')
  @ApiOperation({
    summary: 'Available sizes/colors/brands/price range for the current filter context',
  })
  facets(
    @Query('category') category?: string,
    @Query('brand') brand?: string,
    @Query('q') q?: string,
  ) {
    return this.catalog.facets({ category, brand, q });
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Full product detail (bilingual, with variants and specs)' })
  detail(@Param('slug') slug: string) {
    return this.catalog.productDetail(slug);
  }

  @Get(':slug/related')
  @ApiOperation({ summary: 'Related products from the same category' })
  related(@Param('slug') slug: string) {
    return this.catalog.relatedProducts(slug);
  }
}
