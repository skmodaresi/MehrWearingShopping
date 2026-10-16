import { Link, redirect } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { getSessionUser } from '@/lib/session';
import { AuthForm } from '@/components/auth-form';

interface RegisterPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}

/** Registration page; carries the same `?next=` deep link as login. */
export default async function RegisterPage({ params, searchParams }: RegisterPageProps) {
  const { locale } = await params;
  const { next } = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(`/${locale}/account`);

  const t = await getTranslations('auth');

  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-4 py-14">
      <AuthForm mode="register" locale={locale} nextPath={next} />
      <p className="text-sm text-slate-500">
        {t('hasAccount')}{' '}
        <Link
          href={`/${locale}/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="font-bold text-orange-700 hover:underline"
        >
          {t('loginCta')}
        </Link>
      </p>
    </div>
  );
}
