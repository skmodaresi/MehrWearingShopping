import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { formatDate, formatPrice } from '@/lib/format';
import { getSessionUser } from '@/lib/session';
import { Pagination } from '@/components/pagination';
import type { Order, Paged } from '@mehrwearing/api-client';

interface OrdersPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } };
}

/** Order history (paginated), each row links to the tracking page. */
export default async function OrderListPage({ params, searchParams }: OrdersPageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const viewer = await getSessionUser();
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account/orders`)}`);

  const page = Math.max(1, Number(sp.page) || 1);
  const t = await getTranslations('order');
  const orders = await api<Paged<Order>>(`/orders?page=${page}&limit=10`);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-extrabold text-slate-900">{t('myOrders')}</h1>

      {orders.items.length === 0 ? (
        <div className="card flex flex-col items-center gap-4 p-14 text-center">
          <span className="text-5xl">🧾</span>
          <p className="font-bold text-slate-700">{t('noOrders')}</p>
          <Link href={`/${locale}/products`} className="btn btn-accent">
            {locale === 'fa-IR' ? 'شروع خرید' : 'Start shopping'}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.items.map((order) => (
            <Link
              key={order.id}
              href={`/${locale}/order/${order.orderNumber}`}
              className="card card-hover flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <span>
                <span className="block font-extrabold text-slate-900">
                  <bdi>{order.orderNumber}</bdi>
                </span>
                <span className="block text-xs text-slate-500">
                  <bdi>{formatDate(order.placedAt, locale)}</bdi> · {order.items.length}
                </span>
              </span>

              <span className="flex items-center gap-3">
                <span className="badge badge-accent">{t(`status${order.status}`)}</span>
                <span className="font-extrabold text-slate-900">
                  {formatPrice(order.totalToman, locale)}
                </span>
                <span className="text-sm font-bold text-orange-700">{t('view')} ›</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <Pagination
        locale={locale}
        basePath="/account/orders"
        page={orders.page}
        pages={orders.pages}
      />
    </div>
  );
}
