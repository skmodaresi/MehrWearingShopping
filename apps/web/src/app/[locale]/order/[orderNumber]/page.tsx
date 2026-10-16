import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { apiOr404 } from '@/lib/api';
import { formatDate, formatPrice, pickLocalized } from '@/lib/format';
import { getSessionUser } from '@/lib/session';
import { CancelOrderButton, PayOrderButton } from '@/components/order-actions';
import type { Order } from '@mehrwearing/api-client';

interface OrderPageProps {
  params: Promise<{ locale: string; orderNumber: string }>;
  searchParams: Promise<{ payment?: string }>;
}

export async function generateMetadata({ params }: OrderPageProps): Promise<Metadata> {
  const { locale, orderNumber } = await params;
  const t = await getTranslations({ locale, namespace: 'order' });
  return { title: t('title', { number: orderNumber }), robots: { index: false, follow: false } };
}

/**
 * Order confirmation + tracking page. Also the return target of the payment
 * gateway (`?payment=success|failed|cancelled`).
 */
export default async function OrderPage({ params, searchParams }: OrderPageProps) {
  const { locale, orderNumber } = await params;
  const { payment } = await searchParams;

  const user = await getSessionUser();
  if (!user) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/order/${orderNumber}`)}`);
  }

  const t = await getTranslations('order');
  const tc = await getTranslations('cart');
  const order = await apiOr404<Order>(`/orders/${encodeURIComponent(orderNumber)}`);

  const banners: Record<string, { className: string; text: string }> = {
    success: { className: 'bg-green-50 text-green-800', text: t('paymentSuccess') },
    failed: { className: 'bg-red-50 text-red-700', text: t('paymentFailed') },
    cancelled: { className: 'bg-orange-50 text-orange-700', text: t('paymentCancelled') },
  };
  const banner = payment ? banners[payment] : undefined;
  const payable = order.status === 'PENDING';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {banner && (
        <p className={`mb-6 rounded-xl px-4 py-3 text-sm font-bold ${banner.className}`}>
          {banner.text}
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            {t('title', { number: order.orderNumber })}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('placedAt')}: <bdi>{formatDate(order.placedAt, locale)}</bdi>
          </p>
        </div>
        <span className="badge badge-accent text-sm">{t(`status${order.status}`)}</span>
      </div>

      {order.paymentStatus === 'PAID' && (
        <p className="mb-6 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
          ✓ {t('paymentSuccess')}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          {/* items */}
          <section className="card overflow-x-auto">
            <h2 className="border-b border-slate-100 p-4 font-extrabold text-slate-900">
              {t('items')}
            </h2>
            <table className="w-full min-w-[32rem] text-sm">
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-0">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100">
                          {item.imageUrl && (
                            <img
                              src={item.imageUrl}
                              alt=""
                              width={56}
                              height={56}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </span>
                        <span>
                          <span className="block font-bold text-slate-900">
                            {pickLocalized(locale, item.productNameFa, item.productNameEn)}
                          </span>
                          {item.variantLabel && (
                            <span className="block text-xs text-slate-500">
                              {item.variantLabel}
                            </span>
                          )}
                          <bdi className="block text-xs text-slate-400">{item.sku}</bdi>
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-500">× {item.qty}</td>
                    <td className="p-4 text-end font-bold text-slate-900">
                      {formatPrice(item.lineTotalToman, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* timeline */}
          <section className="card p-5">
            <h2 className="mb-4 font-extrabold text-slate-900">{t('timeline')}</h2>
            <ol className="flex flex-col gap-3">
              {order.timeline.map((entry, index) => (
                <li key={`${entry.status}-${index}`} className="flex items-center gap-3 text-sm">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-900 text-xs text-white">
                    {index + 1}
                  </span>
                  <span className="font-bold text-slate-800">{t(`status${entry.status}`)}</span>
                  <span className="text-slate-400">
                    <bdi>{formatDate(entry.at, locale)}</bdi>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* summary */}
        <aside className="card sticky top-32 flex flex-col gap-4 p-5 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">{t('status')}</span>
            <span className="font-bold text-slate-900">{t(`status${order.status}`)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">{t('recipient')}</span>
            <span className="text-end font-bold text-slate-900">{order.recipientName}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">{t('address')}</span>
            <span className="max-w-[12rem] text-end text-slate-700">
              {order.addressLine}, {order.city}, {order.province}
              <bdi className="mt-1 block text-xs text-slate-400">{order.postalCode}</bdi>
            </span>
          </div>

          <dl className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex justify-between">
              <dt className="text-slate-500">{tc('subtotal')}</dt>
              <dd className="font-semibold">{formatPrice(order.subtotalToman, locale)}</dd>
            </div>
            {order.discountToman > 0 && (
              <div className="flex justify-between text-green-700">
                <dt>{tc('discount')}</dt>
                <dd className="font-semibold">− {formatPrice(order.discountToman, locale)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-500">{tc('shippingCost')}</dt>
              <dd className="font-semibold">{formatPrice(order.shippingCostToman, locale)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-extrabold">
              <dt>{tc('totalPayable')}</dt>
              <dd>{formatPrice(order.totalToman, locale)}</dd>
            </div>
          </dl>

          <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
            {payable && <PayOrderButton orderNumber={order.orderNumber} />}
            {payable && <CancelOrderButton orderNumber={order.orderNumber} locale={locale} />}
            <Link href={`/${locale}/account/orders`} className="btn btn-ghost">
              {t('myOrders')}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
