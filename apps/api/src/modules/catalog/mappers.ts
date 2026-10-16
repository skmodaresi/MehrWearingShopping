/**
 * Catalog serializers. Every public product payload carries both language
 * variants (nameFa/nameEn …) instead of a locale-negotiated string: clients
 * cache one object and render either language instantly, and editors always
 * have the full record.
 */

export interface ProductCardDto {
  id: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  priceToman: number;
  compareAtPriceToman: number | null;
  discountPercent: number;
  image: string | null;
  ratingAverage: number;
  ratingCount: number;
  salesCount: number;
  isFeatured: boolean;
  inStock: boolean;
  stockTotal: number;
  sizes: string[];
  category: { slug: string; nameFa: string; nameEn: string };
  brand: { slug: string; nameFa: string; nameEn: string } | null;
}

export interface ProductVariantDto {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  colorEn: string | null;
  colorHex: string | null;
  priceToman: number | null;
  effectivePriceToman: number;
  stock: number;
  inStock: boolean;
}

type VariantLike = {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  colorEn: string | null;
  colorHex: string | null;
  priceToman: number | null;
  stock: number;
};

type ProductLike = {
  id: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  priceToman: number;
  compareAtPriceToman: number | null;
  ratingAverage: number;
  ratingCount: number;
  salesCount: number;
  isFeatured: boolean;
  images: { url: string }[];
  variants: Array<Pick<VariantLike, 'size' | 'stock'>>;
  category: { slug: string; nameFa: string; nameEn: string };
  brand: { slug: string; nameFa: string; nameEn: string } | null;
};

export type ProductDetailLike = Omit<ProductLike, 'variants' | 'images'> & {
  variants: VariantLike[];
  descriptionFa: string;
  descriptionEn: string;
  weightGram: number | null;
  status: string;
  createdAt: Date;
  specs: Array<{
    keyFa: string;
    keyEn: string;
    valueFa: string;
    valueEn: string;
    position: number;
  }>;
  images: Array<{ url: string; altFa: string | null; altEn: string | null; position: number }>;
};

export function discountPercent(priceToman: number, compareAt: number | null): number {
  if (!compareAt || compareAt <= priceToman) return 0;
  return Math.round((1 - priceToman / compareAt) * 100);
}

export function toProductCard(product: ProductLike): ProductCardDto {
  const stockTotal = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
  const sizes = Array.from(
    new Set(
      product.variants
        .map((variant) => variant.size)
        .filter((size): size is string => Boolean(size)),
    ),
  );
  return {
    id: product.id,
    slug: product.slug,
    nameFa: product.nameFa,
    nameEn: product.nameEn,
    priceToman: product.priceToman,
    compareAtPriceToman: product.compareAtPriceToman,
    discountPercent: discountPercent(product.priceToman, product.compareAtPriceToman),
    image: product.images[0]?.url ?? null,
    ratingAverage: product.ratingAverage,
    ratingCount: product.ratingCount,
    salesCount: product.salesCount,
    isFeatured: product.isFeatured,
    inStock: stockTotal > 0,
    stockTotal,
    sizes,
    category: product.category,
    brand: product.brand,
  };
}

export interface ProductDetailDto extends ProductCardDto {
  descriptionFa: string;
  descriptionEn: string;
  weightGram: number | null;
  status: string;
  createdAt: string;
  images: Array<{ url: string; altFa: string | null; altEn: string | null }>;
  variants: ProductVariantDto[];
  specs: Array<{ keyFa: string; keyEn: string; valueFa: string; valueEn: string }>;
}

/**
 * Row returned by `GET /admin/products`: management needs status, featured
 * flag and per-variant stock — fields the public card deliberately omits.
 */
export interface AdminProductRowDto {
  id: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  priceToman: number;
  compareAtPriceToman: number | null;
  isFeatured: boolean;
  status: string;
  stockTotal: number;
  category: { slug: string; nameFa: string; nameEn: string };
  brand: { slug: string; nameFa: string; nameEn: string } | null;
  variants: Array<{
    id: string;
    sku: string;
    size: string | null;
    color: string | null;
    stock: number;
  }>;
}

type AdminProductLike = {
  id: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  priceToman: number;
  compareAtPriceToman: number | null;
  isFeatured: boolean;
  status: string;
  category: { slug: string; nameFa: string; nameEn: string };
  brand: { slug: string; nameFa: string; nameEn: string } | null;
  variants: Array<{
    id: string;
    sku: string;
    size: string | null;
    color: string | null;
    stock: number;
  }>;
};

export function toAdminProductRow(product: AdminProductLike): AdminProductRowDto {
  return {
    id: product.id,
    slug: product.slug,
    nameFa: product.nameFa,
    nameEn: product.nameEn,
    priceToman: product.priceToman,
    compareAtPriceToman: product.compareAtPriceToman,
    isFeatured: product.isFeatured,
    status: product.status,
    stockTotal: product.variants.reduce((sum, variant) => sum + variant.stock, 0),
    category: product.category,
    brand: product.brand,
    variants: product.variants,
  };
}

export function toProductDetail(product: ProductDetailLike): ProductDetailDto {
  const card = toProductCard(product);
  return {
    ...card,
    descriptionFa: product.descriptionFa,
    descriptionEn: product.descriptionEn,
    weightGram: product.weightGram,
    status: product.status,
    createdAt: product.createdAt.toISOString(),
    images: product.images.map(({ url, altFa, altEn }) => ({ url, altFa, altEn })),
    variants: product.variants.map((variant) => toProductVariant(variant, product.priceToman)),
    specs: product.specs.map(({ keyFa, keyEn, valueFa, valueEn }) => ({
      keyFa,
      keyEn,
      valueFa,
      valueEn,
    })),
  };
}

export function toProductVariant(variant: VariantLike, productPrice: number): ProductVariantDto {
  return {
    id: variant.id,
    sku: variant.sku,
    size: variant.size,
    color: variant.color,
    colorEn: variant.colorEn,
    colorHex: variant.colorHex,
    priceToman: variant.priceToman,
    effectivePriceToman: variant.priceToman ?? productPrice,
    stock: variant.stock,
    inStock: variant.stock > 0,
  };
}

export const toCategoryDto = (category: {
  id: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  imageUrl: string | null;
  parentId: string | null;
  position: number;
  isActive: boolean;
}) => ({
  id: category.id,
  slug: category.slug,
  nameFa: category.nameFa,
  nameEn: category.nameEn,
  imageUrl: category.imageUrl,
  parentId: category.parentId,
  position: category.position,
  isActive: category.isActive,
});

export const toBrandDto = (brand: {
  id: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  country: string | null;
}) => ({
  id: brand.id,
  slug: brand.slug,
  nameFa: brand.nameFa,
  nameEn: brand.nameEn,
  country: brand.country,
});
