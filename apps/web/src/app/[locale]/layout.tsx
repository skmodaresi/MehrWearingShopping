import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { vazirmatn } from '../fonts';
import '../globals.css';
import { isRtl, routing } from '@/i18n/routing';
import { api } from '@/lib/api';
import { getAccessToken, getRefreshToken, getSessionUser } from '@/lib/session';
import { CartProvider } from '@/components/cart-context';
import { SessionBootstrap } from '@/components/session-bootstrap';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import type { Category } from '@mehrwearing/api-client';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

/** Navigation categories are shared by header and footer on every page. */
async function loadCategories(): Promise<Category[]> {
  try {
    return await api<Category[]>('/categories', { anonymous: true });
  } catch (error) {
    // The shell must render even when the API hiccups; pages still fail loudly.
    console.error('[web] failed to load categories', error);
    return [];
  }
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

  return {
    metadataBase: new URL(baseUrl),
    title: { default: t('title'), template: `%s · ${t('title')}` },
    description: t('description'),
    applicationName: 'MehrWearingShopping',
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      siteName: t('title'),
      title: t('title'),
      description: t('description'),
      locale: locale === 'fa-IR' ? 'fa_IR' : 'en_US',
    },
  };
}

/**
 * Root layout: every route lives under `/[locale]`, so this document owns
 * `<html lang dir>`. Persian is RTL, English is LTR — one shared tree.
 */
export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [messages, categories, user, accessToken, refreshToken] = await Promise.all([
    getMessages(),
    loadCategories(),
    getSessionUser(),
    getAccessToken(),
    getRefreshToken(),
  ]);

  // Access cookie gone but refresh cookie still valid → rotate once on load.
  const needsRefresh = !accessToken && Boolean(refreshToken);

  return (
    <html lang={locale} dir={isRtl(locale) ? 'rtl' : 'ltr'} className={vazirmatn.variable}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Tehran">
          <CartProvider>
            <SessionBootstrap needsRefresh={needsRefresh} />
            <SiteHeader locale={locale} categories={categories} user={user} />
            <main className="min-h-[60vh]">{children}</main>
            <SiteFooter locale={locale} categories={categories} />
          </CartProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
