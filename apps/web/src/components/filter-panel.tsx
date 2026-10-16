'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import type { Facets, ProductSort } from '@mehrwearing/api-client';
import { formatPrice, pickLocalized } from '@/lib/format';

interface FilterState {
  sizes?: string[];
  colors?: string[];
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  discount?: boolean;
  sort?: ProductSort;
}

/**
 * Facet sidebar: selects are held locally and pushed into the URL on apply so
 * a filtered catalog stays shareable/bookmarkable.
 */
export function FilterPanel({
  locale,
  basePath,
  facets,
  current,
  raw,
}: {
  locale: string;
  basePath: string;
  facets: Facets;
  current: FilterState;
  raw: Record<string, string | undefined>;
}) {
  const t = useTranslations('list');
  const router = useRouter();

  const [sizes, setSizes] = useState<string[]>(current.sizes ?? []);
  const [colors, setColors] = useState<string[]>(current.colors ?? []);
  const [brand, setBrand] = useState<string>(current.brand ?? '');
  const [minPrice, setMinPrice] = useState(current.minPrice ? String(current.minPrice) : '');
  const [maxPrice, setMaxPrice] = useState(current.maxPrice ? String(current.maxPrice) : '');
  const [inStock, setInStock] = useState(Boolean(current.inStock));
  const [discount, setDiscount] = useState(Boolean(current.discount));

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
  }

  function apply() {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (value && key !== 'page') params.set(key, value); // keep sort/q, drop paging
    }
    if (sizes.length) params.set('sizes', sizes.join(','));
    if (colors.length) params.set('colors', colors.join(','));
    if (brand) params.set('brand', brand);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (inStock) params.set('inStock', '1');
    if (discount) params.set('discount', '1');
    const serialized = params.toString();
    router.push(`/${locale}${basePath}${serialized ? `?${serialized}` : ''}`);
  }

  function clear() {
    setSizes([]);
    setColors([]);
    setBrand('');
    setMinPrice('');
    setMaxPrice('');
    setInStock(false);
    setDiscount(false);
    const sort = raw.sort;
    router.push(`/${locale}${basePath}${sort ? `?sort=${sort}` : ''}`);
  }

  return (
    <aside className="card h-fit p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-extrabold text-slate-900">{t('filters')}</h2>
        <button
          type="button"
          onClick={clear}
          className="text-xs font-bold text-orange-700 hover:underline"
        >
          {t('clear')}
        </button>
      </div>

      <div className="flex flex-col gap-5">
        <fieldset>
          <legend className="label">{t('size')}</legend>
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setSizes((list) => toggle(list, size))}
                className={`h-9 min-w-9 rounded-lg border px-2 text-sm font-bold transition ${
                  sizes.includes(size)
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-slate-500'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </fieldset>

        {facets.colors.length > 0 && (
          <fieldset>
            <legend className="label">{t('color')}</legend>
            <div className="flex flex-wrap gap-2">
              {facets.colors.map((entry) => {
                const active = colors.includes(entry.color);
                return (
                  <button
                    key={entry.color}
                    type="button"
                    title={pickLocalized(locale, entry.color, entry.colorEn ?? entry.color)}
                    onClick={() => setColors((list) => toggle(list, entry.color))}
                    className={`h-7 w-7 rounded-full border-2 transition ${
                      active ? 'border-slate-900 ring-2 ring-orange-400' : 'border-slate-300'
                    }`}
                    style={{ background: entry.colorHex ?? '#cbd5e1' }}
                    aria-pressed={active}
                    aria-label={entry.color}
                  />
                );
              })}
            </div>
          </fieldset>
        )}

        {facets.brands.length > 0 && (
          <fieldset>
            <legend className="label">{t('brand')}</legend>
            <select
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              className="input"
            >
              <option value="">—</option>
              {facets.brands.map((entry) => (
                <option key={entry.slug} value={entry.slug}>
                  {pickLocalized(locale, entry.nameFa, entry.nameEn)}
                </option>
              ))}
            </select>
          </fieldset>
        )}

        <fieldset>
          <legend className="label">{t('priceRange')}</legend>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={10000}
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              placeholder={formatPrice(facets.priceRange.min, locale)}
              className="input py-1.5 text-sm"
              aria-label={t('price')}
            />
            <span className="text-slate-400">—</span>
            <input
              type="number"
              min={0}
              step={10000}
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder={formatPrice(facets.priceRange.max, locale)}
              className="input py-1.5 text-sm"
              aria-label={t('price')}
            />
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={inStock}
            onChange={(event) => setInStock(event.target.checked)}
          />
          {t('onlyInStock')}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={discount}
            onChange={(event) => setDiscount(event.target.checked)}
          />
          {t('onlyDiscount')}
        </label>

        <button type="button" onClick={apply} className="btn btn-primary">
          {t('apply')}
        </button>
      </div>
    </aside>
  );
}

/** Sort dropdown that navigates immediately (sort lives in the URL). */
export function SortSelect({
  locale,
  basePath,
  sort,
  raw,
}: {
  locale: string;
  basePath: string;
  sort: ProductSort;
  raw: Record<string, string | undefined>;
}) {
  const t = useTranslations('list');
  const router = useRouter();

  const labels: Record<ProductSort, string> = {
    newest: t('sortNewest'),
    'price-asc': t('sortPriceAsc'),
    'price-desc': t('sortPriceDesc'),
    rating: t('sortRating'),
    bestseller: t('sortBestseller'),
  };

  function change(next: ProductSort) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (value && key !== 'page' && key !== 'sort') params.set(key, value);
    }
    params.set('sort', next);
    router.push(`/${locale}${basePath}?${params.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
      {t('sortBy')}
      <select
        value={sort}
        onChange={(event) => change(event.target.value as ProductSort)}
        className="input w-auto py-1.5 text-sm"
      >
        {(Object.keys(labels) as ProductSort[]).map((value) => (
          <option key={value} value={value}>
            {labels[value]}
          </option>
        ))}
      </select>
    </label>
  );
}
