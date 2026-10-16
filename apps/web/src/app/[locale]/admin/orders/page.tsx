import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { formatDate, formatPrice } from '@/lib/format';
import { OrderStatusSelect } from '@/components/admin-controls';
import { Pagination } from '@/components/pagination';
import type { Order, OrderStatus, Paged } from '@mehrwearing/api-client';

interface AdminOrdersPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; page?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } };
}

const STATUSES: Array<OrderStatus | 'ALL'> = [
  'ALL',
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

/** Order management: status filter, status transitions, per-order link. */
export default async function AdminOrdersPage({ params, searchParams }: AdminOrdersPageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as OrderStatus)
    ? (sp.status as OrderStatus)
    : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const t = await getTranslations('admin');
  const query = new URLSearchParams({ page: String(page), limit: '20' });
  if (status) query.set('status', status);
  const orders = await api<Paged<Order>>(`/admin/orders?${query.toString()}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((entry) => {
          const active = (status ?? 'ALL') === entry;
          return (
            <Link
              key={entry}
              href={`/${locale}/admin/orders${entry === 'ALL' ? '' : `?status=${entry}`}`}
              className={`badge ${active ? 'badge-accent' : 'badge-muted'} hover:opacity-80`}
            >
              {entry === 'ALL' ? '•' : entry}
            </Link>
          );
        })}
      </div>

      <section className="card overflow-x-auto">
        {orders.items.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">{t('noOrders')}</p>
        ) : (
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <th className="p-3 text-start font-bold">{t('title')}</th>
                <th className="p-3 text-start font-bold">{t('customer')}</th>
                <th className="p-3 text-start font-bold">{t('date')}</th>
                <th className="p-3 text-start font-bold">{t('total')}</th>
                <th className="p-3 text-start font-bold">{t('status')}</th>
                <th className="p-3 text-start font-bold">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.items.map((order) => (
                <tr key={order.id} className="border-b border-slate-100 last:border-0">
                  <td className="p-3">
                    <Link
                      href={`/${locale}/order/${order.orderNumber}`}
                      className="font-bold text-slate-900 hover:text-orange-700"
                    >
                      <bdi>{order.orderNumber}</bdi>
                    </Link>
                  </td>
                  <td className="p-3 text-slate-600">
                    {order.customer?.fullName ?? order.recipientName}
                  </td>
                  <td className="p-3 text-slate-500">
                    <bdi>{formatDate(order.placedAt, locale)}</bdi>
                  </td>
                  <td className="p-3 font-bold">{formatPrice(order.totalToman, locale)}</td>
                  <td className="p-3">
                    <span className="badge badge-muted">{order.status}</span>
                  </td>
                  <td className="p-3">
                    <OrderStatusSelect orderId={order.id} current={order.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Pagination
        locale={locale}
        basePath="/admin/orders"
        page={orders.page}
        pages={orders.pages}
        query={status ? { status } : undefined}
      />
    </div>
  );
}
