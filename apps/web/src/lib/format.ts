/**
 * Presentation-layer formatting. Money is stored as integer Toman everywhere;
 * only these functions decide how it is *displayed* — Persian digits and
 * «تومان» for fa-IR, Latin digits and "Toman" for en.
 */

export function isFa(locale: string): boolean {
  return locale.startsWith('fa');
}

/** Locale-aware display name: picks the fa or en column of a bilingual row. */
export function pickLocalized(locale: string, nameFa: string, nameEn: string): string {
  return isFa(locale) ? nameFa : nameEn;
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(isFa(locale) ? 'fa-IR' : 'en-US').format(value);
}

/** 1490000 → «۱٬۴۹۰٬۰۰۰ تومان» (fa) / «1,490,000 Toman» (en) */
export function formatPrice(priceToman: number, locale: string): string {
  const number = formatNumber(priceToman, locale);
  return isFa(locale) ? `${number} تومان` : `${number} Toman`;
}

/** Jalali (Persian calendar) dates for fa-IR, Gregorian for en. */
export function formatDate(value: string | Date, locale: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(isFa(locale) ? 'fa-IR-u-ca-persian' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | Date, locale: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(isFa(locale) ? 'fa-IR-u-ca-persian' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/** Whole days between an ISO timestamp and now (for «۳ روز پیش» style copy). */
export function daysSince(value: string | Date): number {
  const date = typeof value === 'string' ? new Date(value) : value;
  const diff = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

/** Rating display: 4.5 stays 4.5, but Persian readers expect ۴٫۵. */
export function formatRating(value: number, locale: string): string {
  return new Intl.NumberFormat(isFa(locale) ? 'fa-IR' : 'en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}
