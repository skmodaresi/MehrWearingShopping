import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { getSessionUser } from '@/lib/session';
import { ProductGrid } from '@/components/product-grid';
import type { ProductCard } from '@mehrwearing/api-client';

export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } };
}

/** Wishlist grid (requires an account — the API keys it by user id). */
export default async function WishlistPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const viewer = await getSessionUser();
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/wishlist`)}`);

  const t = await getTranslations('account');
  const items = await api<ProductCard[]>('/wishlist');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-extrabold text-slate-900">{t('wishlist')}</h1>

      {items.length === 0 ? (
        <div className="card flex flex-col items-center gap-4 p-14 text-center">
          <span className="text-5xl">🤍</span>
          <p className="font-bold text-slate-700">{t('emptyWishlist')}</p>
          <Link href={`/${locale}/products`} className="btn btn-accent">
            {locale === 'fa-IR' ? 'شروع خرید' : 'Start shopping'}
          </Link>
        </div>
      ) : (
        <ProductGrid products={items} locale={locale} />
      )}
    </div>
  );
}
