import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { getSessionUser } from '@/lib/session';
import { PasswordForm } from '@/components/password-form';
import { ProfileForm } from '@/components/profile-form';
import type { User } from '@mehrwearing/api-client';

export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } };
}

/** Account home: profile editor, quick links and password change. */
export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const viewer = await getSessionUser();
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account`)}`);

  const t = await getTranslations('account');
  const tOrder = await getTranslations('order');
  const user = await api<User>('/auth/me');

  const links = [
    { href: `/${locale}/account/orders`, label: tOrder('myOrders'), icon: '📦' },
    { href: `/${locale}/wishlist`, label: t('wishlist'), icon: '♥' },
    { href: `/${locale}/account/addresses`, label: t('addresses'), icon: '📍' },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('welcome', { name: user.fullName })}</p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="card card-hover flex items-center gap-3 p-4"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-50 text-lg">
              {link.icon}
            </span>
            <span className="font-bold text-slate-800">{link.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ProfileForm user={user} />
        <PasswordForm />
      </div>
    </div>
  );
}
