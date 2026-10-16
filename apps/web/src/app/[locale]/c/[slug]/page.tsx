import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { api, apiOr404 } from '@/lib/api';
import { parseCatalogSearchParams, toProductQueryString, type SearchParams } from '@/lib/catalog';
import { pickLocalized } from '@/lib/format';
import { FilterPanel, SortSelect } from '@/components/filter-panel';
import { Pagination } from '@/components/pagination';
import { ProductGrid } from '@/components/product-grid';
import type { Category, Facets, Paged, ProductCard } from '@mehrwearing/api-client';

interface CategoryPageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  try {
    const category = await apiOr404<Category>(`/categories/${encodeURIComponent(slug)}`, {
      anonymous: true,
      locale,
    });
    return { title: pickLocalized(locale, category.nameFa, category.nameEn) };
  } catch {
    return {};
  }
}

/** Category listing: `/c/[slug]` (linked from header and footer). */
export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { locale, slug } = await params;
  const sp = await searchParams;
  const { query, facet, raw } = parseCatalogSearchParams(sp, { category: slug });

  const facetParams = new URLSearchParams({ category: slug });
  if (facet.brand) facetParams.set('brand', facet.brand);
  if (facet.q) facetParams.set('q', facet.q);

  const [t, category, products, facets] = await Promise.all([
    getTranslations('list'),
    apiOr404<Category>(`/categories/${encodeURIComponent(slug)}`, { anonymous: true, locale }),
    api<Paged<ProductCard>>(`/products${toProductQueryString(query)}`, { anonymous: true, locale }),
    api<Facets>(`/products/facets?${facetParams.toString()}`, { anonymous: true, locale }),
  ]);

  const name = pickLocalized(locale, category.nameFa, category.nameEn);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{name}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('results', { count: products.total })}</p>
        </div>
        <SortSelect
          locale={locale}
          basePath={`/c/${slug}`}
          sort={query.sort ?? 'newest'}
          raw={raw}
        />
      </div>

      {category.children && category.children.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {category.children.map((child) => (
            <a
              key={child.id}
              href={`/${locale}/c/${child.slug}`}
              className="badge badge-muted hover:bg-slate-200"
            >
              {pickLocalized(locale, child.nameFa, child.nameEn)}
            </a>
          ))}
        </div>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[16rem_1fr]">
        <FilterPanel
          locale={locale}
          basePath={`/c/${slug}`}
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
            basePath={`/c/${slug}`}
            page={products.page}
            pages={products.pages}
            query={raw}
          />
        </div>
      </div>
    </div>
  );
}
