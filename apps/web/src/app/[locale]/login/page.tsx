import { Link, redirect } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { getSessionUser } from '@/lib/session';
import { AuthForm } from '@/components/auth-form';

interface LoginPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}

/** Sign-in page; `?next=` restores the deep link after authentication. */
export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const { locale } = await params;
  const { next } = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(`/${locale}/account`);

  const t = await getTranslations('auth');

  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-4 py-14">
      <AuthForm mode="login" locale={locale} nextPath={next} />
      <p className="text-sm text-slate-500">
        {t('noAccount')}{' '}
        <Link
          href={`/${locale}/register${next ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="font-bold text-orange-700 hover:underline"
        >
          {t('registerCta')}
        </Link>
      </p>
    </div>
  );
}
