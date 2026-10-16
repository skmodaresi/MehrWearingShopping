import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api, apiOr404 } from '@/lib/api';
import { daysSince, formatNumber, formatPrice, formatRating, pickLocalized } from '@/lib/format';
import { getSessionUser } from '@/lib/session';
import { AddToCart } from '@/components/add-to-cart';
import { ImageGallery } from '@/components/image-gallery';
import { ProductGrid } from '@/components/product-grid';
import { RatingStars } from '@/components/rating-stars';
import { ReviewForm } from '@/components/review-form';
import { WishlistButton } from '@/components/wishlist-button';
import type { Paged, ProductCard, ProductDetail, Review } from '@mehrwearing/api-client';

interface ProductPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  try {
    const product = await apiOr404<ProductDetail>(`/products/${encodeURIComponent(slug)}`, {
      anonymous: true,
      locale,
    });
    const name = pickLocalized(locale, product.nameFa, product.nameEn);
    const description = pickLocalized(locale, product.descriptionFa, product.descriptionEn).slice(
      0,
      160,
    );
    return {
      title: name,
      description,
      openGraph: { title: name, description, images: product.image ? [product.image] : [] },
    };
  } catch {
    return {};
  }
}

/** Product detail: gallery, variants, specs, reviews and related items. */
export default async function ProductPage({ params }: ProductPageProps) {
  const { locale, slug } = await params;
  const user = await getSessionUser();

  const [t, product, reviews, related] = await Promise.all([
    getTranslations('product'),
    apiOr404<ProductDetail>(`/products/${encodeURIComponent(slug)}`, { anonymous: true, locale }),
    api<Paged<Review>>(`/products/${encodeURIComponent(slug)}/reviews`, {
      anonymous: true,
      locale,
    }),
    api<ProductCard[]>(`/products/${encodeURIComponent(slug)}/related`, {
      anonymous: true,
      locale,
    }),
  ]);

  let wishlisted = false;
  if (user) {
    try {
      const wishlist = await api<ProductCard[]>('/wishlist');
      wishlisted = wishlist.some((item) => item.id === product.id);
    } catch {
      wishlisted = false;
    }
  }

  const name = pickLocalized(locale, product.nameFa, product.nameEn);
  const description = pickLocalized(locale, product.descriptionFa, product.descriptionEn);
  const brandName = product.brand
    ? pickLocalized(locale, product.brand.nameFa, product.brand.nameEn)
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* breadcrumbs */}
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Link href={`/${locale}`} className="hover:text-orange-700">
          {locale === 'fa-IR' ? 'مهرویر' : 'MehrWearing'}
        </Link>
        <span>›</span>
        <Link href={`/${locale}/c/${product.category.slug}`} className="hover:text-orange-700">
          {pickLocalized(locale, product.category.nameFa, product.category.nameEn)}
        </Link>
        <span>›</span>
        <span className="text-slate-700">{name}</span>
      </nav>

      <div className="grid items-start gap-8 lg:grid-cols-2">
        <ImageGallery images={product.images} alt={name} />

        <div className="flex flex-col gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="badge badge-muted">
                {pickLocalized(locale, product.category.nameFa, product.category.nameEn)}
              </span>
              {brandName && <span className="badge badge-accent">{brandName}</span>}
              {product.discountPercent > 0 && (
                <span className="badge badge-discount">
                  {product.discountPercent}
                  {locale === 'fa-IR' ? '٪' : '%'}
                </span>
              )}
            </div>

            <h1 className="mt-3 text-2xl font-black leading-9 text-slate-900 sm:text-3xl">
              {name}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <RatingStars
                value={product.ratingAverage}
                count={product.ratingCount}
                locale={locale}
              />
              <span>{formatRating(product.ratingAverage, locale)}</span>
              <span>·</span>
              <span>{t('basedOn', { count: formatNumber(product.ratingCount, locale) })}</span>
            </div>
          </div>

          <div className="card flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-end gap-3">
              <span className="text-3xl font-black text-slate-900">
                {formatPrice(product.priceToman, locale)}
              </span>
              {product.compareAtPriceToman && product.compareAtPriceToman > product.priceToman && (
                <span className="price-old">
                  {formatPrice(product.compareAtPriceToman, locale)}
                </span>
              )}
            </div>

            <p
              className={`text-sm font-bold ${product.inStock ? 'text-green-700' : 'text-red-600'}`}
            >
              {product.inStock
                ? product.stockTotal <= 5
                  ? t('onlyLeft', { count: formatNumber(product.stockTotal, locale) })
                  : t('inStock')
                : t('outOfStock')}
            </p>

            <AddToCart product={product} locale={locale} />

            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              <WishlistButton productId={product.id} initialActive={wishlisted} />
              <span className="text-xs text-slate-500">🚚 {t('shippingNote')}</span>
              <span className="text-xs text-slate-500">↩ {t('guarantee')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* description + specs */}
      <div className="mt-12 grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="card p-6">
          <h2 className="mb-3 text-lg font-extrabold text-slate-900">{t('description')}</h2>
          <p className="whitespace-pre-line text-sm leading-8 text-slate-600">{description}</p>

          {product.specs.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-lg font-extrabold text-slate-900">{t('specs')}</h2>
              <table className="w-full text-sm">
                <tbody>
                  {product.specs.map((spec, index) => (
                    <tr key={index} className="border-b border-slate-100 last:border-0">
                      <th className="w-1/3 p-3 text-start font-bold text-slate-600">
                        {pickLocalized(locale, spec.keyFa, spec.keyEn)}
                      </th>
                      <td className="p-3 text-slate-700">
                        {pickLocalized(locale, spec.valueFa, spec.valueEn)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>

        <aside className="card h-fit p-5 text-sm">
          <dl className="flex flex-col gap-3">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">{t('sku')}</dt>
              <dd className="font-bold text-slate-800">
                <bdi>{product.variants[0]?.sku ?? '—'}</bdi>
              </dd>
            </div>
            {brandName && (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">{t('brand')}</dt>
                <dd className="font-bold text-slate-800">{brandName}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">{t('category')}</dt>
              <dd className="font-bold text-slate-800">
                {pickLocalized(locale, product.category.nameFa, product.category.nameEn)}
              </dd>
            </div>
            {product.weightGram && (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">{t('weight')}</dt>
                <dd className="font-bold text-slate-800">
                  <bdi>
                    {formatNumber(product.weightGram, locale)} {t('gr')}
                  </bdi>
                </dd>
              </div>
            )}
          </dl>
        </aside>
      </div>

      {/* reviews */}
      <section className="mt-12">
        <h2 className="mb-4 text-lg font-extrabold text-slate-900">{t('reviews')}</h2>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="flex flex-col gap-3">
            {reviews.items.length === 0 && (
              <p className="card p-6 text-sm text-slate-500">{t('noReviews')}</p>
            )}
            {reviews.items.map((review) => (
              <article key={review.id} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">{review.customerName}</span>
                  <span className="text-xs text-slate-400">
                    {t('daysAgo', { days: daysSince(review.createdAt) })}
                  </span>
                </div>
                <div className="mt-1">
                  <RatingStars value={review.rating} locale={locale} />
                </div>
                {review.title && <h3 className="mt-2 font-bold text-slate-800">{review.title}</h3>}
                <p className="mt-1 text-sm leading-7 text-slate-600">{review.body}</p>
              </article>
            ))}
          </div>

          <aside className="card h-fit p-5">
            {user ? (
              <ReviewForm productId={product.id} />
            ) : (
              <div className="flex flex-col gap-3 text-sm">
                <p className="text-slate-600">{t('reviewLoginRequired')}</p>
                <Link href={`/${locale}/login`} className="btn btn-outline">
                  {locale === 'fa-IR' ? 'ورود' : 'Sign in'}
                </Link>
              </div>
            )}
          </aside>
        </div>
      </section>

      {/* related */}
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-lg font-extrabold text-slate-900">{t('related')}</h2>
          <ProductGrid products={related} locale={locale} />
        </section>
      )}
    </div>
  );
}
