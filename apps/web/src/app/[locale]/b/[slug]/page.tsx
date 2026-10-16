import { getTranslations } from 'next-intl/server';
import { api } from '@/lib/api';
import { parseCatalogSearchParams, toProductQueryString, type SearchParams } from '@/lib/catalog';
import { pickLocalized } from '@/lib/format';
import { FilterPanel, SortSelect } from '@/components/filter-panel';
import { Pagination } from '@/components/pagination';
import { ProductGrid } from '@/components/product-grid';
import type { Brand, Facets, Paged, ProductCard } from '@mehrwearing/api-client';

interface BrandPageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<SearchParams>;
}

/** Brand landing page: `/b/[slug]`, reached from product tiles and facets. */
export default async function BrandPage({ params, searchParams }: BrandPageProps) {
  const { locale, slug } = await params;
  const sp = await searchParams;
  const { query, facet, raw } = parseCatalogSearchParams(sp, { brand: slug });

  const facetParams = new URLSearchParams({ brand: slug });
  if (facet.category) facetParams.set('category', facet.category);
  if (facet.q) facetParams.set('q', facet.q);

  const [t, brands, products, facets] = await Promise.all([
    getTranslations('list'),
    api<Brand[]>('/brands', { anonymous: true, locale }),
    api<Paged<ProductCard>>(`/products${toProductQueryString(query)}`, { anonymous: true, locale }),
    api<Facets>(`/products/facets?${facetParams.toString()}`, { anonymous: true, locale }),
  ]);

  const brand = brands.find((entry) => entry.slug === slug);
  const name = brand ? pickLocalized(locale, brand.nameFa, brand.nameEn) : slug;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{name}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('results', { count: products.total })}</p>
        </div>
        <SortSelect
          locale={locale}
          basePath={`/b/${slug}`}
          sort={query.sort ?? 'newest'}
          raw={raw}
        />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[16rem_1fr]">
        <FilterPanel
          locale={locale}
          basePath={`/b/${slug}`}
          facets={facets}
          current={query}
          raw={raw}
        />

        <div>
          <ProductGrid products={products.items} locale={locale} empty={t('empty')} />
          {products.items.length === 0 && (
            <p className="mt-3 text-sm text-slate-500">{t('emptyHint')}</p>
          )}
          <Pagination
            locale={locale}
            basePath={`/b/${slug}`}
            page={products.page}
            pages={products.pages}
            query={raw}
          />
        </div>
      </div>
    </div>
  );
}
