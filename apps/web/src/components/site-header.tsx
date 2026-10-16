'use client';

import { Suspense, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { useCart } from './cart-context';
import type { Category } from '@mehrwearing/api-client';
import { pickLocalized } from '@/lib/format';
import { logoutAction } from '@/actions/auth';

interface HeaderProps {
  locale: string;
  categories: Category[];
  user: { fullName: string; role: 'ADMIN' | 'CUSTOMER' } | null;
}

export function SiteHeader({ locale, categories, user }: HeaderProps) {
  const t = useTranslations('header');
  const { itemCount } = useCart();
  const router = useRouter();
  const [query, setQuery] = useState('');

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(`/${locale}/search${trimmed ? `?q=${encodeURIComponent(trimmed)}` : ''}`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link href={`/${locale}`} className="flex shrink-0 items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-lg font-black text-white">
            م
          </span>
          <span className="hidden text-lg font-extrabold tracking-tight text-slate-900 sm:block">
            {locale === 'fa-IR' ? 'مهرویر' : 'MehrWearing'}
          </span>
        </Link>

        <form onSubmit={submitSearch} className="relative hidden min-w-0 flex-1 md:block">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('search')}
            className="input ps-10"
          />
          <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-slate-400">
            🔍
          </span>
        </form>

        <nav className="ms-auto flex items-center gap-1 sm:gap-2">
          <Suspense fallback={null}>
            <LocaleSwitcher locale={locale} />
          </Suspense>

          {user ? (
            <div className="flex items-center gap-1">
              <Link
                href={`/${locale}/account`}
                className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:block"
              >
                {user.fullName.split(' ')[0]}
              </Link>
              {user.role === 'ADMIN' && (
                <Link
                  href={`/${locale}/admin`}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-50"
                >
                  {t('admin')}
                </Link>
              )}
              <button
                type="button"
                onClick={async () => {
                  await logoutAction();
                  router.push(`/${locale}`);
                  router.refresh();
                }}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
              >
                {t('logout')}
              </button>
            </div>
          ) : (
            <Link
              href={`/${locale}/login`}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              {t('login')}
            </Link>
          )}

          <Link
            href={`/${locale}/wishlist`}
            aria-label={t('wishlist')}
            className="rounded-lg px-3 py-2 text-lg hover:bg-slate-100"
          >
            ♡
          </Link>

          <Link
            href={`/${locale}/cart`}
            aria-label={t('cart')}
            className="relative rounded-lg px-3 py-2 text-lg hover:bg-slate-100"
          >
            🛒
            {itemCount > 0 && (
              <span className="absolute -top-0.5 end-0 grid h-5 min-w-5 place-items-center rounded-full bg-orange-600 px-1 text-[11px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </Link>
        </nav>
      </div>

      {/* category strip */}
      <div className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 text-sm [scrollbar-width:none]">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/${locale}/c/${category.slug}`}
              className="whitespace-nowrap rounded-full px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {pickLocalized(locale, category.nameFa, category.nameEn)}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}

/** Switches the current page between fa-IR and en, preserving query params. */
function LocaleSwitcher({ locale }: { locale: string }) {
  const t = useTranslations('header');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const other = locale === 'fa-IR' ? 'en' : 'fa-IR';
  const suffix = searchParams.toString();
  // Raw pathname already includes the locale prefix.
  const withoutLocale = pathname.replace(/^\/(fa-IR|en)(?=\/|$)/, '') || '';

  return (
    <Link
      href={`/${other}${withoutLocale}${suffix ? `?${suffix}` : ''}`}
      hrefLang={other}
      aria-label={t('languageLabel')}
      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:border-slate-400"
    >
      {t('language')}
    </Link>
  );
}
