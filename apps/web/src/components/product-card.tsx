'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { ProductCard as ProductCardData } from '@mehrwearing/api-client';
import { formatPrice, pickLocalized } from '@/lib/format';
import { RatingStars } from './rating-stars';

/**
 * Catalog tile used by home, category, search and wishlist grids.
 * Presentational: all data comes from the API's bilingual ProductCard shape.
 */
export function ProductCard({
  product,
  locale,
  showRating = true,
}: {
  product: ProductCardData;
  locale: string;
  showRating?: boolean;
}) {
  const t = useTranslations('list');
  const tProduct = useTranslations('product');
  const name = pickLocalized(locale, product.nameFa, product.nameEn);
  const soldOut = !product.inStock;

  return (
    <Link
      href={`/${locale}/p/${product.slug}`}
      className="card card-hover group flex flex-col overflow-hidden"
      aria-label={name}
    >
      <span className="product-media">
        {product.image && (
          // Plain img: the placeholders are local SVGs (no optimizer needed).
          <img src={product.image} alt={name} loading="lazy" width={640} height={640} />
        )}
        {product.discountPercent > 0 && (
          <span className="badge badge-discount absolute top-2 start-2 z-10">
            {product.discountPercent}
            {t('off')}
          </span>
        )}
        {soldOut && (
          <span className="badge absolute top-2 end-2 z-10 bg-slate-900/80 text-white">
            {tProduct('outOfStock')}
          </span>
        )}
      </span>

      <span className="flex flex-1 flex-col gap-2 p-4">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400" dir="auto">
          {pickLocalized(locale, product.category.nameFa, product.category.nameEn)}
          {product.brand
            ? ` · ${pickLocalized(locale, product.brand.nameFa, product.brand.nameEn)}`
            : ''}
        </span>
        <span className="line-clamp-2 font-bold leading-6 text-slate-900 transition-colors group-hover:text-orange-700">
          {name}
        </span>

        {showRating && (
          <RatingStars value={product.ratingAverage} count={product.ratingCount} locale={locale} />
        )}

        <span className="mt-auto flex items-baseline gap-2">
          <span className="text-lg font-extrabold text-slate-900">
            {formatPrice(product.priceToman, locale)}
          </span>
          {product.compareAtPriceToman && (
            <span className="price-old">{formatPrice(product.compareAtPriceToman, locale)}</span>
          )}
        </span>
      </span>
    </Link>
  );
}
