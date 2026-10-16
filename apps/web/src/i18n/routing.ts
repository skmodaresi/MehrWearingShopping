import { defineRouting } from 'next-intl/routing';

/**
 * Persian is the product's primary language: it is the default locale and
 * every URL is locale-prefixed (`/fa-IR/...`, `/en/...`) so crawlers and
 * users always see an explicit, stable language.
 */
export const routing = defineRouting({
  locales: ['fa-IR', 'en'],
  defaultLocale: 'fa-IR',
  localePrefix: 'always',
  localeDetection: false,
});

export const locales = routing.locales;
export type Locale = (typeof routing.locales)[number];
export const isRtl = (locale: string): boolean => locale === 'fa-IR';
