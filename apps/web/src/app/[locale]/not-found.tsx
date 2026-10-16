import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('common');

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 text-center">
      <span className="text-6xl">🧦</span>
      <h1 className="text-2xl font-extrabold text-slate-900">{t('notFoundTitle')}</h1>
      <p className="text-sm leading-7 text-slate-500">{t('notFoundText')}</p>
      <Link href="/" className="btn btn-primary">
        {t('home')}
      </Link>
    </div>
  );
}
