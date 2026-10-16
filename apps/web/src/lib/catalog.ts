import type { ProductListQuery, ProductSort } from '@mehrwearing/api-client';

/**
 * Catalog search-param parsing shared by /products, /c/[slug], /b/[slug] and
 * /search. Keeps URL parsing (stringly typed) and API typing (strongly typed)
 * in one place, and preserves the raw values for pagination hrefs.
 */
export type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Same as {@link ProductListQuery} but with list-valued filters always typed
 * as arrays — the API accepts `sizes=M,L`, the UI only ever holds arrays.
 */
export interface CatalogFilters extends Omit<ProductListQuery, 'sizes' | 'colors'> {
  sizes?: string[];
  colors?: string[];
}

const SORTS: ProductSort[] = ['newest', 'price-asc', 'price-desc', 'rating', 'bestseller'];

function first(value: string | string[] | undefined): string | undefined {
  const item = Array.isArray(value) ? value[0] : value;
  return item && item.length > 0 ? item : undefined;
}

function positiveInt(value: string | string[] | undefined): number | undefined {
  const parsed = Number(first(value));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function list(value: string | string[] | undefined): string[] | undefined {
  const raw = Array.isArray(value) ? value.join(',') : first(value);
  if (!raw) return undefined;
  const items = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function bool(value: string | string[] | undefined): boolean | undefined {
  const raw = first(value);
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return undefined;
}

export interface CatalogQuery {
  /** Validated filters for `GET /products`. */
  query: CatalogFilters;
  /** The subset that scopes facets (category/brand/search term). */
  facet: { category?: string; brand?: string; q?: string };
  /** Raw query params preserved when the user changes page or sort. */
  raw: Record<string, string | undefined>;
}

export function parseCatalogSearchParams(
  searchParams: SearchParams,
  overrides: Partial<CatalogFilters> = {},
): CatalogQuery {
  const sortRaw = first(searchParams.sort);
  const sort = SORTS.includes(sortRaw as ProductSort)
    ? (sortRaw as ProductSort)
    : (overrides.sort ?? 'newest');

  // The URL always wins; the page's own scope (e.g. a category slug) is the
  // fallback, so `/c/shirts?brand=acme` filters within shirts.
  const query: CatalogFilters = {
    category: first(searchParams.category) ?? overrides.category,
    brand: first(searchParams.brand) ?? overrides.brand,
    q: first(searchParams.q) ?? overrides.q,
    minPrice: positiveInt(searchParams.minPrice) ?? overrides.minPrice,
    maxPrice: positiveInt(searchParams.maxPrice) ?? overrides.maxPrice,
    sizes: list(searchParams.sizes) ?? overrides.sizes,
    colors: list(searchParams.colors) ?? overrides.colors,
    inStock: bool(searchParams.inStock) ?? overrides.inStock,
    discount: bool(searchParams.discount) ?? overrides.discount,
    featured: bool(searchParams.featured) ?? overrides.featured,
    sort,
    page: positiveInt(searchParams.page) ?? 1,
    limit: positiveInt(searchParams.limit) ?? overrides.limit ?? 24,
  };

  const raw: Record<string, string | undefined> = {};
  for (const key of [
    'category',
    'brand',
    'q',
    'minPrice',
    'maxPrice',
    'sizes',
    'colors',
    'inStock',
    'discount',
    'sort',
  ]) {
    const value = first(searchParams[key]);
    if (value) raw[key] = value;
  }

  return { query, facet: { category: query.category, brand: query.brand, q: query.q }, raw };
}

/** Serializes a product query into a URL query string (empty when blank). */
export function toProductQueryString(query: ProductListQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(','));
    } else if (typeof value === 'boolean') {
      params.set(key, value ? '1' : '0');
    } else {
      params.set(key, String(value));
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}
