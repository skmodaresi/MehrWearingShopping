import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { formatNumber, pickLocalized } from '@/lib/format';
import { ProductCard } from '@/components/product-card';
import type { Category, Paged, ProductCard as ProductCardData } from '@mehrwearing/api-client';

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

/** Home fetches read-only public data; a slow catalog must not block the shell. */
async function loadHome(locale: string) {
  const [featured, deals, categories] = await Promise.all([
    api<Paged<ProductCardData>>('/products/featured', { anonymous: true, locale }),
    api<Paged<ProductCardData>>('/products/deals', { anonymous: true, locale }),
    api<Category[]>('/categories', { anonymous: true, locale }),
  ]);
  return { featured: featured.items, deals: deals.items, categories };
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const t = await getTranslations('home');
  const { featured, deals, categories } = await loadHome(locale);

  const valueProps = [
    { title: t('why1Title'), text: t('why1Text'), icon: '✓' },
    { title: t('why2Title'), text: t('why2Text'), icon: '🚚' },
    { title: t('why3Title'), text: t('why3Text'), icon: '🔒' },
    { title: t('why4Title'), text: t('why4Text'), icon: '↩' },
  ];

  return (
    <>
      {/* --- hero ------------------------------------------------------------ */}
      <section className="bg-slate-900 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 sm:py-20 lg:grid-cols-2">
          <div className="flex flex-col items-start gap-5">
            <span className="badge badge-accent">{t('heroBadge')}</span>
            <h1 className="text-3xl font-black leading-tight sm:text-5xl">{t('heroTitle')}</h1>
            <p className="max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
              {t('heroText')}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href={`/${locale}/products`} className="btn btn-accent">
                {t('heroCta')}
              </Link>
              <Link
                href={`/${locale}/products?discount=1`}
                className="btn btn-outline border-white/40 text-white"
              >
                {t('heroSecondary')}
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {categories.slice(0, 6).map((category) => (
              <Link
                key={category.id}
                href={`/${locale}/c/${category.slug}`}
                className="group rounded-2xl border border-white/10 bg-white/5 p-4 text-center transition hover:border-orange-400 hover:bg-white/10"
              >
                <span className="block text-2xl">👕</span>
                <span className="mt-2 block text-sm font-bold text-white">
                  {pickLocalized(locale, category.nameFa, category.nameEn)}
                </span>
                <span className="mt-1 block text-xs text-slate-400">
                  {formatNumber(category.productCount ?? 0, locale)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-7xl flex-col gap-16 px-4 py-14">
        {/* --- categories ----------------------------------------------------- */}
        <section>
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-extrabold text-slate-900">{t('categories')}</h2>
            <Link
              href={`/${locale}/products`}
              className="text-sm font-bold text-orange-700 hover:underline"
            >
              ›
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/${locale}/c/${category.slug}`}
                className="card card-hover flex flex-col items-center gap-2 p-5 text-center"
              >
                <span className="grid h-12 w-12 place-items-center rounded-full bg-orange-50 text-xl">
                  🧥
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {pickLocalized(locale, category.nameFa, category.nameEn)}
                </span>
                <span className="text-xs text-slate-500">
                  {formatNumber(category.productCount ?? 0, locale)}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* --- featured ------------------------------------------------------- */}
        <section>
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900">{t('featured')}</h2>
              <p className="mt-1 text-sm text-slate-500">{t('featuredText')}</p>
            </div>
            <Link
              href={`/${locale}/products?sort=bestseller`}
              className="text-sm font-bold text-orange-700 hover:underline"
            >
              ›
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} />
            ))}
          </div>
        </section>

        {/* --- deals ---------------------------------------------------------- */}
        {deals.length > 0 && (
          <section>
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900">{t('deals')}</h2>
                <p className="mt-1 text-sm text-slate-500">{t('dealsText')}</p>
              </div>
              <Link
                href={`/${locale}/products?discount=1`}
                className="text-sm font-bold text-orange-700 hover:underline"
              >
                ›
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {deals.map((product) => (
                <ProductCard key={product.id} product={product} locale={locale} />
              ))}
            </div>
          </section>
        )}

        {/* --- why us --------------------------------------------------------- */}
        <section className="rounded-3xl bg-white p-6 ring-1 ring-slate-200 sm:p-10">
          <h2 className="mb-6 text-center text-2xl font-extrabold text-slate-900">
            {t('whyTitle')}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {valueProps.map((item) => (
              <div key={item.title} className="flex flex-col gap-2 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-orange-50 text-xl">
                  {item.icon}
                </span>
                <h3 className="font-extrabold text-slate-900">{item.title}</h3>
                <p className="text-sm leading-6 text-slate-500">{item.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
