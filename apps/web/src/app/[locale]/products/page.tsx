import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { api } from '@/lib/api';
import { parseCatalogSearchParams, toProductQueryString, type SearchParams } from '@/lib/catalog';
import { FilterPanel, SortSelect } from '@/components/filter-panel';
import { Pagination } from '@/components/pagination';
import { ProductGrid } from '@/components/product-grid';
import type { Facets, Paged, ProductCard } from '@mehrwearing/api-client';

interface ProductsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}

async function facetsQuery(facet: {
  category?: string;
  brand?: string;
  q?: string;
}): Promise<string> {
  const params = new URLSearchParams();
  if (facet.category) params.set('category', facet.category);
  if (facet.brand) params.set('brand', facet.brand);
  if (facet.q) params.set('q', facet.q);
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export async function generateMetadata({ params }: ProductsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'list' });
  return { title: t('allProducts') };
}

/** Full catalog: faceted filters, sort and pagination, all URL-driven. */
export default async function ProductsPage({ params, searchParams }: ProductsPageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const { query, facet, raw } = parseCatalogSearchParams(sp);
  const facetString = await facetsQuery(facet);

  const [t, products, facets] = await Promise.all([
    getTranslations('list'),
    api<Paged<ProductCard>>(`/products${toProductQueryString(query)}`, { anonymous: true, locale }),
    api<Facets>(`/products/facets${facetString}`, { anonymous: true, locale }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-slate-900">
        {t('results', { count: products.total })}
      </h1>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[16rem_1fr]">
        <FilterPanel
          locale={locale}
          basePath="/products"
          facets={facets}
          current={query}
          raw={raw}
        />

        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">{t('results', { count: products.total })}</p>
            <SortSelect
              locale={locale}
              basePath="/products"
              sort={query.sort ?? 'newest'}
              raw={raw}
            />
          </div>

          <ProductGrid products={products.items} locale={locale} empty={t('empty')} />
          {products.items.length === 0 && (
            <p className="mt-3 text-sm text-slate-500">{t('emptyHint')}</p>
          )}

          <Pagination
            locale={locale}
            basePath="/products"
            page={products.page}
            pages={products.pages}
            query={raw}
          />
        </div>
      </div>
    </div>
  );
}
