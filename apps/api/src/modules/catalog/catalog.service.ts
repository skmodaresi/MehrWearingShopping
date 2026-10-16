import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
import { ApiException } from '../../common/http/api-exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ilikePattern, normalizeForSearch, slugify } from '../../common/utils/persian';
import { paged, Paged, parsePagination } from '../../common/utils/pagination';
import {
  AdminBrandDto,
  AdminCategoryDto,
  AdminProductDto,
  AdminVariantDto,
  ProductListQueryDto,
  ProductSort,
} from './dto';
import {
  AdminProductRowDto,
  ProductCardDto,
  ProductDetailDto,
  toAdminProductRow,
  toBrandDto,
  toCategoryDto,
  toProductCard,
  toProductDetail,
} from './mappers';

export const cardInclude = {
  images: { orderBy: { position: 'asc' as const }, take: 2 },
  variants: { select: { size: true, stock: true } },
  category: { select: { slug: true, nameFa: true, nameEn: true } },
  brand: { select: { slug: true, nameFa: true, nameEn: true } },
} satisfies Prisma.ProductInclude;

const detailInclude = {
  images: { orderBy: { position: 'asc' as const } },
  variants: { orderBy: [{ size: 'asc' as const }, { colorHex: 'asc' as const }] },
  specs: { orderBy: { position: 'asc' as const } },
  category: { select: { slug: true, nameFa: true, nameEn: true } },
  brand: { select: { slug: true, nameFa: true, nameEn: true } },
} satisfies Prisma.ProductInclude;

const sortMap: Record<ProductSort, Prisma.ProductOrderByWithRelationInput> = {
  newest: { createdAt: 'desc' },
  'price-asc': { priceToman: 'asc' },
  'price-desc': { priceToman: 'desc' },
  rating: { ratingAverage: 'desc' },
  bestseller: { salesCount: 'desc' },
};

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Public catalog
  // -------------------------------------------------------------------------

  async listProducts(query: ProductListQueryDto): Promise<Paged<ProductCardDto>> {
    const params = parsePagination(query);
    const where = this.buildProductWhere(query);
    const [total, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: sortMap[query.sort ?? 'newest'],
        skip: params.skip,
        take: params.take,
        include: cardInclude,
      }),
    ]);
    return paged(items.map(toProductCard), total, params);
  }

  async featuredProducts(limit = 8): Promise<Paged<ProductCardDto>> {
    return this.listProducts({ featured: true, sort: 'bestseller', limit });
  }

  async deals(limit = 8): Promise<Paged<ProductCardDto>> {
    return this.listProducts({ discount: true, sort: 'bestseller', limit });
  }

  async facets(filters: { category?: string; brand?: string; q?: string }) {
    const base: Prisma.ProductWhereInput = {
      status: 'ACTIVE',
      ...(filters.category ? { category: { slug: filters.category } } : {}),
      ...(filters.brand ? { brand: { slug: filters.brand } } : {}),
      ...(filters.q
        ? { searchText: { contains: ilikePattern(filters.q).slice(1, -1), mode: 'insensitive' } }
        : {}),
    };

    const [sizeRows, colorRows, price, brands, total] = await Promise.all([
      this.prisma.productVariant.findMany({
        where: { product: base },
        distinct: ['size'],
        select: { size: true },
      }),
      this.prisma.productVariant.findMany({
        where: { product: base, color: { not: null } },
        distinct: ['color', 'colorEn', 'colorHex'],
        select: { color: true, colorEn: true, colorHex: true },
      }),
      this.prisma.product.aggregate({
        where: base,
        _min: { priceToman: true },
        _max: { priceToman: true },
      }),
      this.prisma.brand.findMany({
        where: { products: { some: base } },
        select: { slug: true, nameFa: true, nameEn: true },
        orderBy: { nameEn: 'asc' },
      }),
      this.prisma.product.count({ where: base }),
    ]);

    return {
      sizes: sizeRows
        .map((row) => row.size)
        .filter((size): size is string => Boolean(size))
        .sort(),
      colors: colorRows.filter((row) => row.color !== null),
      priceRange: { min: price._min.priceToman ?? 0, max: price._max.priceToman ?? 0 },
      brands,
      total,
    };
  }

  async productDetail(
    slug: string,
    options: { includeInactive?: boolean } = {},
  ): Promise<ProductDetailDto> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: detailInclude,
    });
    if (!product || (!options.includeInactive && product.status !== 'ACTIVE')) {
      throw ApiException.notFound('PRODUCT_NOT_FOUND', `No product with slug "${slug}"`);
    }
    return toProductDetail(product);
  }

  async relatedProducts(slug: string, limit = 8): Promise<ProductCardDto[]> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      select: { categoryId: true },
    });
    if (!product) return [];
    const items = await this.prisma.product.findMany({
      where: { status: 'ACTIVE', categoryId: product.categoryId, slug: { not: slug } },
      orderBy: { ratingAverage: 'desc' },
      take: limit,
      include: cardInclude,
    });
    return items.map(toProductCard);
  }

  async categories() {
    const [categories, counts] = await Promise.all([
      this.prisma.category.findMany({ where: { isActive: true }, orderBy: { position: 'asc' } }),
      this.prisma.product.groupBy({
        by: ['categoryId'],
        where: { status: 'ACTIVE' },
        _count: { _all: true },
      }),
    ]);
    const countMap = new Map(counts.map((row) => [row.categoryId, row._count._all]));
    return categories.map((category) => ({
      ...toCategoryDto(category),
      productCount: countMap.get(category.id) ?? 0,
    }));
  }

  async category(slug: string) {
    const category = await this.prisma.category.findUnique({ where: { slug } });
    if (!category || !category.isActive) {
      throw ApiException.notFound('CATEGORY_NOT_FOUND', `No category with slug "${slug}"`);
    }
    const [children, productCount] = await Promise.all([
      this.prisma.category.findMany({
        where: { parentId: category.id, isActive: true },
        orderBy: { position: 'asc' },
      }),
      this.prisma.product.count({ where: { categoryId: category.id, status: 'ACTIVE' } }),
    ]);
    return {
      ...toCategoryDto(category),
      productCount,
      children: children.map(toCategoryDto),
    };
  }

  async brands() {
    const [brands, counts] = await Promise.all([
      this.prisma.brand.findMany({ orderBy: { nameEn: 'asc' } }),
      this.prisma.product.groupBy({
        by: ['brandId'],
        where: { status: 'ACTIVE' },
        _count: { _all: true },
      }),
    ]);
    const countMap = new Map(
      counts
        .filter((row) => row.brandId !== null)
        .map((row) => [row.brandId as string, row._count._all]),
    );
    return brands.map((brand) => ({
      ...toBrandDto(brand),
      productCount: countMap.get(brand.id) ?? 0,
    }));
  }

  // -------------------------------------------------------------------------
  // Admin mutations
  // -------------------------------------------------------------------------

  /**
   * Management listing: every status (DRAFT/ACTIVE/HIDDEN) plus per-variant
   * stock, which the public card intentionally hides. Supports a text query
   * over the same normalized `searchText` column the storefront searches.
   */
  async adminListProducts(query: {
    q?: string;
    page?: number;
    limit?: number;
  }): Promise<Paged<AdminProductRowDto>> {
    const params = parsePagination(query);
    const search = query.q?.trim();
    const where: Prisma.ProductWhereInput = search
      ? { searchText: { contains: ilikePattern(search).slice(1, -1), mode: 'insensitive' } }
      : {};

    const [total, rows] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: {
          variants: {
            select: { id: true, sku: true, size: true, color: true, stock: true },
            orderBy: [{ size: 'asc' as const }, { colorHex: 'asc' as const }],
          },
          category: { select: { slug: true, nameFa: true, nameEn: true } },
          brand: { select: { slug: true, nameFa: true, nameEn: true } },
        },
      }),
    ]);

    return paged(rows.map(toAdminProductRow), total, params);
  }

  async createProduct(dto: AdminProductDto): Promise<ProductDetailDto> {
    if (!dto.category)
      throw ApiException.badRequest('CATEGORY_REQUIRED', 'category slug is required');
    const category = await this.prisma.category.findUnique({ where: { slug: dto.category } });
    if (!category) throw ApiException.notFound('CATEGORY_NOT_FOUND', 'Category not found');
    const brand = dto.brand
      ? await this.prisma.brand.findUnique({ where: { slug: dto.brand } })
      : null;
    if (dto.brand && !brand) throw ApiException.notFound('BRAND_NOT_FOUND', 'Brand not found');

    const slug = dto.slug
      ? slugify(dto.slug, dto.slug)
      : slugify(dto.nameEn, `p-${randomBytes(4).toString('hex')}`);
    const existing = await this.prisma.product.findUnique({ where: { slug } });
    if (existing)
      throw ApiException.conflict('SLUG_TAKEN', `A product with slug "${slug}" already exists`);

    await this.prisma.product.create({
      data: {
        slug,
        categoryId: category.id,
        brandId: brand?.id ?? null,
        nameFa: dto.nameFa,
        nameEn: dto.nameEn,
        descriptionFa: dto.descriptionFa ?? '',
        descriptionEn: dto.descriptionEn ?? '',
        searchText: searchTextFor(dto.nameFa, dto.nameEn, slug, dto.category, dto.brand),
        priceToman: dto.priceToman,
        compareAtPriceToman: dto.compareAtPriceToman ?? null,
        status: dto.status ?? 'ACTIVE',
        isFeatured: dto.isFeatured ?? false,
        variants: dto.variants?.length
          ? { create: dto.variants.map((variant) => this.variantData(variant)) }
          : undefined,
        specs: dto.specs?.length
          ? {
              create: dto.specs.map((spec, index) => ({
                keyFa: spec.keyFa,
                keyEn: spec.keyEn,
                valueFa: spec.valueFa,
                valueEn: spec.valueEn,
                position: index,
              })),
            }
          : undefined,
      },
    });
    return this.productDetail(slug, { includeInactive: true });
  }

  async updateProduct(id: string, dto: Partial<AdminProductDto>): Promise<ProductDetailDto> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        slug: true,
        nameFa: true,
        nameEn: true,
        category: { select: { slug: true } },
        brand: { select: { slug: true } },
      },
    });
    if (!product) throw ApiException.notFound('PRODUCT_NOT_FOUND', 'Product not found');

    const categorySlug = dto.category ?? product.category.slug;
    const brandSlug = dto.brand ?? product.brand?.slug;

    let categoryId: string | undefined;
    if (dto.category) {
      const category = await this.prisma.category.findUnique({ where: { slug: dto.category } });
      if (!category) throw ApiException.notFound('CATEGORY_NOT_FOUND', 'Category not found');
      categoryId = category.id;
    }
    let brandId: string | null | undefined;
    if (dto.brand !== undefined) {
      if (dto.brand === '') brandId = null;
      else {
        const brand = await this.prisma.brand.findUnique({ where: { slug: dto.brand } });
        if (!brand) throw ApiException.notFound('BRAND_NOT_FOUND', 'Brand not found');
        brandId = brand.id;
      }
    }

    await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.nameFa !== undefined ? { nameFa: dto.nameFa } : {}),
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn } : {}),
        ...(dto.descriptionFa !== undefined ? { descriptionFa: dto.descriptionFa } : {}),
        ...(dto.descriptionEn !== undefined ? { descriptionEn: dto.descriptionEn } : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
        ...(brandId !== undefined ? { brandId } : {}),
        ...(dto.priceToman !== undefined ? { priceToman: dto.priceToman } : {}),
        ...(dto.compareAtPriceToman !== undefined
          ? { compareAtPriceToman: dto.compareAtPriceToman }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.isFeatured !== undefined ? { isFeatured: dto.isFeatured } : {}),
        searchText: searchTextFor(
          dto.nameFa ?? product.nameFa,
          dto.nameEn ?? product.nameEn,
          product.slug,
          categorySlug,
          brandSlug,
        ),
      },
    });
    return this.productDetail(product.slug, { includeInactive: true });
  }

  async addVariant(productId: string, dto: AdminVariantDto): Promise<ProductDetailDto> {
    await this.assertProduct(productId);
    const duplicate = await this.prisma.productVariant.findUnique({ where: { sku: dto.sku } });
    if (duplicate) throw ApiException.conflict('SKU_TAKEN', `SKU "${dto.sku}" already exists`);
    await this.prisma.productVariant.create({ data: { ...this.variantData(dto), productId } });
    const product = await this.prisma.product.findUniqueOrThrow({ where: { id: productId } });
    return this.productDetail(product.slug, { includeInactive: true });
  }

  async setVariantStock(
    productId: string,
    variantId: string,
    stock: number,
    actorId: string,
  ): Promise<ProductDetailDto> {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant || variant.productId !== productId) {
      throw ApiException.notFound('VARIANT_NOT_FOUND', 'Variant not found');
    }
    const delta = stock - variant.stock;
    await this.prisma.$transaction([
      this.prisma.productVariant.update({ where: { id: variantId }, data: { stock } }),
      ...(delta !== 0
        ? [
            this.prisma.inventoryMovement.create({
              data: { variantId, delta, reason: 'ADJUST', userId: actorId },
            }),
          ]
        : []),
    ]);
    const product = await this.prisma.product.findUniqueOrThrow({ where: { id: productId } });
    return this.productDetail(product.slug, { includeInactive: true });
  }

  async upsertCategory(id: string | null, dto: AdminCategoryDto) {
    const slug = slugify(dto.slug, dto.slug);
    if (id) {
      const category = await this.prisma.category.update({
        where: { id },
        data: {
          nameFa: dto.nameFa,
          nameEn: dto.nameEn,
          imageUrl: dto.imageUrl,
          position: dto.position,
        },
      });
      return toCategoryDto(category);
    }
    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing) throw ApiException.conflict('SLUG_TAKEN', `Category "${slug}" already exists`);
    const category = await this.prisma.category.create({
      data: {
        slug,
        nameFa: dto.nameFa,
        nameEn: dto.nameEn,
        imageUrl: dto.imageUrl ?? null,
        position: dto.position ?? 0,
      },
    });
    return toCategoryDto(category);
  }

  async upsertBrand(id: string | null, dto: AdminBrandDto) {
    const slug = slugify(dto.slug, dto.slug);
    if (id) {
      const brand = await this.prisma.brand.update({
        where: { id },
        data: { nameFa: dto.nameFa, nameEn: dto.nameEn, country: dto.country },
      });
      return toBrandDto(brand);
    }
    const existing = await this.prisma.brand.findUnique({ where: { slug } });
    if (existing) throw ApiException.conflict('SLUG_TAKEN', `Brand "${slug}" already exists`);
    const brand = await this.prisma.brand.create({
      data: { slug, nameFa: dto.nameFa, nameEn: dto.nameEn, country: dto.country ?? null },
    });
    return toBrandDto(brand);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  buildProductWhere(query: ProductListQueryDto): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = { status: 'ACTIVE' };
    if (query.category) where.category = { slug: query.category };
    if (query.brand) where.brand = { slug: query.brand };
    if (query.q)
      where.searchText = { contains: ilikePattern(query.q).slice(1, -1), mode: 'insensitive' };
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.priceToman = { gte: query.minPrice, lte: query.maxPrice };
    }
    if (query.discount) where.compareAtPriceToman = { not: null };
    if (query.featured) where.isFeatured = true;

    const variantFilters: Prisma.ProductVariantWhereInput[] = [];
    if (query.sizes?.length) variantFilters.push({ size: { in: query.sizes } });
    if (query.colors?.length)
      variantFilters.push({
        OR: [{ color: { in: query.colors } }, { colorEn: { in: query.colors } }],
      });
    if (query.inStock) variantFilters.push({ stock: { gt: 0 } });

    if (variantFilters.length > 0) {
      // All variant filters must match the *same* variant (a size-42 black shoe).
      where.variants = { some: { AND: variantFilters } };
    }
    return where;
  }

  private variantData(
    variant: AdminVariantDto,
  ): Omit<Prisma.ProductVariantUncheckedCreateInput, 'productId'> {
    return {
      size: variant.size || null,
      color: variant.color || null,
      colorEn: variant.colorEn || null,
      colorHex: variant.colorHex ?? null,
      sku: variant.sku,
      priceToman: variant.priceToman ?? null,
      stock: variant.stock,
    };
  }

  private async assertProduct(id: string): Promise<void> {
    const product = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) throw ApiException.notFound('PRODUCT_NOT_FOUND', 'Product not found');
  }
}

function searchTextFor(
  nameFa: string | undefined,
  nameEn: string | undefined,
  slug: string,
  category?: string,
  brand?: string,
): string {
  return normalizeForSearch(
    [nameFa ?? '', nameEn ?? '', slug, category ?? '', brand ?? ''].join(' '),
  );
}
