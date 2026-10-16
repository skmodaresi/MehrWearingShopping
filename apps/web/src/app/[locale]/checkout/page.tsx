import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { api, ServerApiError } from '@/lib/api';
import { getSessionUser } from '@/lib/session';
import { CheckoutPanel } from '@/components/checkout-panel';
import type { Address, Cart } from '@mehrwearing/api-client';

interface CheckoutPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: CheckoutPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'checkout' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * Checkout requires an account (the API ties orders to a user); guests are
 * bounced to login with a `?next=` link back here.
 */
export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { locale } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/checkout`)}`);
  }

  const t = await getTranslations('checkout');

  let cart: Cart | null = null;
  let addresses: Address[] = [];
  try {
    cart = await api<Cart>('/cart');
  } catch (error) {
    if (!(error instanceof ServerApiError)) console.error('[web] cart load failed', error);
  }
  try {
    addresses = await api<Address[]>('/users/me/addresses');
  } catch {
    addresses = [];
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <p className="text-lg font-extrabold text-slate-900">{t('emptyCart')}</p>
        <Link href={`/${locale}/cart`} className="btn btn-primary mt-4">
          {t('title')}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-extrabold text-slate-900">{t('title')}</h1>
      <CheckoutPanel locale={locale} cart={cart} addresses={addresses} />
    </div>
  );
}
