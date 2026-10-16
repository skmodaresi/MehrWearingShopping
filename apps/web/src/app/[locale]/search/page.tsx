import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { api } from '@/lib/api';
import { parseCatalogSearchParams, toProductQueryString, type SearchParams } from '@/lib/catalog';
import { FilterPanel, SortSelect } from '@/components/filter-panel';
import { Pagination } from '@/components/pagination';
import { ProductGrid } from '@/components/product-grid';
import type { Facets, Paged, ProductCard } from '@mehrwearing/api-client';

interface SearchPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q : '';
  if (!q) return {};
  return { title: `«${q}»`, robots: { index: false, follow: true } };
}

/** Full-text search results (`/search?q=…` from the header search box). */
export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const { query, facet, raw } = parseCatalogSearchParams(sp);

  const facetParams = new URLSearchParams();
  if (facet.q) facetParams.set('q', facet.q);
  if (facet.category) facetParams.set('category', facet.category);
  if (facet.brand) facetParams.set('brand', facet.brand);

  const [t, products, facets] = await Promise.all([
    getTranslations('list'),
    api<Paged<ProductCard>>(`/products${toProductQueryString(query)}`, { anonymous: true, locale }),
    api<Facets>(`/products/facets${facetParams.toString() ? `?${facetParams.toString()}` : ''}`, {
      anonymous: true,
      locale,
    }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            {t('results', { count: products.total })}
          </h1>
          {facet.q && (
            <p className="mt-1 text-sm text-slate-500">
              <bdi>«{facet.q}»</bdi>
            </p>
          )}
        </div>
        <SortSelect locale={locale} basePath="/search" sort={query.sort ?? 'newest'} raw={raw} />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[16rem_1fr]">
        <FilterPanel locale={locale} basePath="/search" facets={facets} current={query} raw={raw} />

        <div>
          <ProductGrid products={products.items} locale={locale} empty={t('empty')} />
          {products.items.length === 0 && (
            <p className="mt-3 text-sm text-slate-500">{t('emptyHint')}</p>
          )}
          <Pagination
            locale={locale}
            basePath="/search"
            page={products.page}
            pages={products.pages}
            query={raw}
          />
        </div>
      </div>
    </div>
  );
}
