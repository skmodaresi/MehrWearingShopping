import { getTranslations } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { getSessionUser } from '@/lib/session';

/**
 * Admin shell: only `role=ADMIN` gets past this guard, and every page below
 * inherits the section navigation. Authorization is re-checked by the API on
 * each call — this guard is for UX, not security.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/admin`)}`);
  if (user.role !== 'ADMIN') redirect(`/${locale}/account`);

  const t = await getTranslations('admin');
  const tabs = [
    { href: `/${locale}/admin`, label: t('dashboard') },
    { href: `/${locale}/admin/orders`, label: t('manageOrders') },
    { href: `/${locale}/admin/products`, label: t('manageProducts') },
    { href: `/${locale}/admin/reviews`, label: t('manageReviews') },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-extrabold text-slate-900">{t('title')}</h1>
      <nav className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
