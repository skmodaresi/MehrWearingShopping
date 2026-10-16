import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { formatPrice, pickLocalized } from '@/lib/format';
import { ProductRowEditor, StockEditor } from '@/components/admin-controls';
import { Pagination } from '@/components/pagination';
import type { AdminProductRow, Paged } from '@mehrwearing/api-client';

interface AdminProductsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } };
}

/**
 * Product management: price / featured / visibility toggles plus per-variant
 * stock counters (each write records an inventory movement server-side).
 */
export default async function AdminProductsPage({ params, searchParams }: AdminProductsPageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = typeof sp.q === 'string' ? sp.q : '';

  const t = await getTranslations('admin');
  const query = new URLSearchParams({ page: String(page), limit: '20' });
  if (q) query.set('q', q);
  const products = await api<Paged<AdminProductRow>>(`/admin/products?${query.toString()}`);

  return (
    <div className="flex flex-col gap-4">
      <form className="flex gap-2" method="GET">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t('manageProducts')}
          className="input max-w-xs"
        />
        <button type="submit" className="btn btn-outline">
          {t('update')}
        </button>
      </form>

      <section className="card overflow-x-auto">
        {products.items.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">—</p>
        ) : (
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <th className="p-3 text-start font-bold">{t('productsCount')}</th>
                <th className="p-3 text-start font-bold">{t('price')}</th>
                <th className="p-3 text-start font-bold">{t('stock')}</th>
                <th className="p-3 text-start font-bold">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {products.items.map((product) => (
                <tr key={product.id} className="border-b border-slate-100 align-top last:border-0">
                  <td className="p-3">
                    <Link
                      href={`/${locale}/p/${product.slug}`}
                      className="font-bold text-slate-900 hover:text-orange-700"
                    >
                      {pickLocalized(locale, product.nameFa, product.nameEn)}
                    </Link>
                    <span className="block text-xs text-slate-500">
                      {pickLocalized(locale, product.category.nameFa, product.category.nameEn)} ·{' '}
                      <bdi>{product.slug}</bdi>
                    </span>
                    <span className="mt-1 flex gap-1">
                      <span
                        className={`badge ${product.status === 'ACTIVE' ? 'badge-success' : 'badge-muted'}`}
                      >
                        {product.status}
                      </span>
                      {product.stockTotal === 0 && <span className="badge badge-discount">0</span>}
                    </span>
                  </td>

                  <td className="p-3">
                    <ProductRowEditor
                      productId={product.id}
                      priceToman={product.priceToman}
                      isFeatured={product.isFeatured}
                      status={product.status as 'DRAFT' | 'ACTIVE' | 'HIDDEN'}
                    />
                    {product.compareAtPriceToman && (
                      <span className="mt-1 block text-xs text-slate-400">
                        <bdi>{formatPrice(product.compareAtPriceToman, locale)}</bdi>
                      </span>
                    )}
                  </td>

                  <td className="p-3">
                    <ul className="flex flex-col gap-2">
                      {product.variants.map((variant) => (
                        <li key={variant.id} className="flex items-center gap-2">
                          <bdi className="w-24 truncate text-xs text-slate-500">{variant.sku}</bdi>
                          <StockEditor
                            productId={product.id}
                            variantId={variant.id}
                            stock={variant.stock}
                          />
                        </li>
                      ))}
                      {product.variants.length === 0 && (
                        <li className="text-xs text-slate-400">—</li>
                      )}
                    </ul>
                  </td>

                  <td className="p-3">
                    <Link href={`/${locale}/p/${product.slug}`} className="btn btn-ghost btn-sm">
                      ›
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Pagination
        locale={locale}
        basePath="/admin/products"
        page={products.page}
        pages={products.pages}
        query={q ? { q } : undefined}
      />
    </div>
  );
}
