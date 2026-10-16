import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { formatDate, formatNumber, formatPrice, pickLocalized } from '@/lib/format';
import type { AdminStats } from '@mehrwearing/api-client';

export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } };
}

/** Dashboard: revenue KPIs, order mix, low stock, top sellers, latest orders. */
export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('admin');
  const stats = await api<AdminStats>('/admin/stats');

  const kpis = [
    { label: t('revenueToday'), value: formatPrice(stats.revenue.todayToman, locale) },
    { label: t('revenueMonth'), value: formatPrice(stats.revenue.monthToman, locale) },
    { label: t('revenueAll'), value: formatPrice(stats.revenue.allTimeToman, locale) },
    { label: t('ordersCount'), value: formatNumber(stats.orders.total, locale) },
    { label: t('customers'), value: formatNumber(stats.customers, locale) },
    { label: t('productsCount'), value: formatNumber(stats.products, locale) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="card p-4">
            <p className="text-xs font-semibold text-slate-500">{kpi.label}</p>
            <p className="mt-1 text-lg font-extrabold text-slate-900">{kpi.value}</p>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* recent orders */}
        <section className="card overflow-x-auto">
          <h2 className="border-b border-slate-100 p-4 font-extrabold text-slate-900">
            {t('recentOrders')}
          </h2>
          {stats.recentOrders.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">{t('noOrders')}</p>
          ) : (
            <table className="w-full min-w-[28rem] text-sm">
              <tbody>
                {stats.recentOrders.map((order) => (
                  <tr key={order.orderNumber} className="border-b border-slate-100 last:border-0">
                    <td className="p-3">
                      <Link
                        href={`/${locale}/order/${order.orderNumber}`}
                        className="font-bold text-slate-900 hover:text-orange-700"
                      >
                        <bdi>{order.orderNumber}</bdi>
                      </Link>
                      <span className="block text-xs text-slate-500">{order.customer}</span>
                    </td>
                    <td className="p-3 text-xs text-slate-500">
                      <bdi>{formatDate(order.placedAt, locale)}</bdi>
                    </td>
                    <td className="p-3">
                      <span className="badge badge-muted">{order.status}</span>
                    </td>
                    <td className="p-3 text-end font-bold">
                      {formatPrice(order.totalToman, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* top products + low stock */}
        <div className="flex flex-col gap-6">
          <section className="card">
            <h2 className="border-b border-slate-100 p-4 font-extrabold text-slate-900">
              {t('topProducts')}
            </h2>
            <ul>
              {stats.topProducts.map((product) => (
                <li
                  key={product.slug}
                  className="flex items-center gap-3 border-b border-slate-100 p-3 last:border-0"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100">
                    {product.image && (
                      <img
                        src={product.image}
                        alt=""
                        width={40}
                        height={40}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-800">
                      {pickLocalized(locale, product.nameFa, product.nameEn)}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {formatNumber(product.salesCount, locale)} ×
                    </span>
                  </span>
                  <span className="text-sm font-extrabold">
                    {formatPrice(product.priceToman, locale)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2 className="border-b border-slate-100 p-4 font-extrabold text-slate-900">
              {t('lowStock')}
            </h2>
            <ul>
              {stats.lowStock.map((entry) => (
                <li
                  key={entry.sku}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 p-3 text-sm last:border-0"
                >
                  <span>
                    <span className="block font-bold text-slate-800">
                      {pickLocalized(locale, entry.product.nameFa, entry.product.nameEn)}
                    </span>
                    <bdi className="block text-xs text-slate-400">
                      {entry.sku} · {entry.size ?? '—'}
                    </bdi>
                  </span>
                  <span
                    className={`badge ${entry.stock === 0 ? 'badge-discount' : 'badge-accent'}`}
                  >
                    {formatNumber(entry.stock, locale)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
