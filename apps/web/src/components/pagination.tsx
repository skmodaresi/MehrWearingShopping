import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

interface PaginationProps {
  locale: string;
  basePath: string;
  page: number;
  pages: number;
  /** Query params that must survive page changes (filters, search…). */
  query?: Record<string, string | number | undefined>;
}

function hrefFor(
  locale: string,
  basePath: string,
  page: number,
  query: PaginationProps['query'],
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  if (page > 1) params.set('page', String(page));
  const serialized = params.toString();
  return `/${locale}${basePath}${serialized ? `?${serialized}` : ''}`;
}

export function Pagination({ locale, basePath, page, pages, query }: PaginationProps) {
  const t = useTranslations('list');
  if (pages <= 1) return null;

  return (
    <nav className="mt-10 flex items-center justify-center gap-2" aria-label="pagination">
      {page > 1 ? (
        <Link href={hrefFor(locale, basePath, page - 1, query)} className="btn btn-outline btn-sm">
          {t('prev')}
        </Link>
      ) : (
        <span className="btn btn-outline btn-sm cursor-not-allowed opacity-40">{t('prev')}</span>
      )}

      <span className="px-3 text-sm font-semibold text-slate-600">
        {t('page', { page, pages })}
      </span>

      {page < pages ? (
        <Link href={hrefFor(locale, basePath, page + 1, query)} className="btn btn-outline btn-sm">
          {t('next')}
        </Link>
      ) : (
        <span className="btn btn-outline btn-sm cursor-not-allowed opacity-40">{t('next')}</span>
      )}
    </nav>
  );
}
