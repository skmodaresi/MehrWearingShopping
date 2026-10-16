import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api, ServerApiError } from '@/lib/api';
import { CartView } from '@/components/cart-view';
import type { Cart } from '@mehrwearing/api-client';

interface CartPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: CartPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cart' });
  return { title: t('title') };
}

/**
 * Cart page. The cart itself lives on the API keyed by the guest-cart cookie,
 * so this reads it server-side and hands a snapshot to the interactive view.
 */
export default async function CartPage({ params }: CartPageProps) {
  const { locale } = await params;
  const t = await getTranslations('cart');

  let cart: Cart | null = null;
  try {
    cart = await api<Cart>('/cart');
  } catch (error) {
    // An empty/unknown cart id is normal — anything else still renders empty
    // because the API seeds a fresh guest cart on the next request.
    if (!(error instanceof ServerApiError)) console.error('[web] cart load failed', error);
  }

  const hasItems = Boolean(cart && cart.items.length > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-extrabold text-slate-900">{t('title')}</h1>

      {!hasItems ? (
        <div className="card flex flex-col items-center gap-4 p-14 text-center">
          <span className="text-5xl">🛒</span>
          <div>
            <p className="text-lg font-extrabold text-slate-900">{t('empty')}</p>
            <p className="mt-1 text-sm text-slate-500">{t('emptyText')}</p>
          </div>
          <Link href={`/${locale}/products`} className="btn btn-accent">
            {t('emptyCta')}
          </Link>
        </div>
      ) : (
        <CartView cart={cart!} locale={locale} />
      )}
    </div>
  );
}
