'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Category } from '@mehrwearing/api-client';
import { pickLocalized } from '@/lib/format';

export function SiteFooter({ locale, categories }: { locale: string; categories: Category[] }) {
  const t = useTranslations('footer');

  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 font-black text-white">
              م
            </span>
            <span className="font-extrabold text-slate-900">{t('aboutTitle')}</span>
          </div>
          <p className="text-sm leading-7 text-slate-500">{t('aboutText')}</p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-900">
            {t('shopTitle')}
          </h3>
          <ul className="space-y-2 text-sm text-slate-500">
            {categories.slice(0, 6).map((category) => (
              <li key={category.slug}>
                <Link href={`/${locale}/c/${category.slug}`} className="hover:text-orange-700">
                  {pickLocalized(locale, category.nameFa, category.nameEn)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-900">
            {t('serviceTitle')}
          </h3>
          <ul className="space-y-2 text-sm text-slate-500">
            <li>{t('help')}</li>
            <li>{t('returns')}</li>
            <li>{t('privacy')}</li>
            <li>{t('terms')}</li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-900">
            {t('contactTitle')}
          </h3>
          <ul className="space-y-2 text-sm text-slate-500">
            <li>
              <bdi>{t('contactPhone')}</bdi>
            </li>
            <li>
              <bdi>{t('contactEmail')}</bdi>
            </li>
          </ul>
          <form className="mt-4 flex gap-2" onSubmit={(event) => event.preventDefault()}>
            <input
              type="email"
              required
              placeholder={t('newsletterPlaceholder')}
              aria-label={t('newsletter')}
              className="input"
            />
            <button type="submit" className="btn btn-primary btn-sm shrink-0">
              {t('newsletterCta')}
            </button>
          </form>
        </div>
      </div>

      <div className="border-t border-slate-100 py-5 text-center text-xs text-slate-400">
        {t('rights')}
      </div>
    </footer>
  );
}
