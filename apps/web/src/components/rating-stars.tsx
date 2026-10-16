'use client';

import { useTranslations } from 'next-intl';
import { formatRating } from '@/lib/format';

export function RatingStars({
  value,
  count,
  locale,
}: {
  value: number;
  count?: number;
  locale: string;
}) {
  const t = useTranslations('product');
  const rounded = Math.round(value);
  const stars = Array.from({ length: 5 }, (_, index) => (index < rounded ? '★' : '☆')).join('');

  return (
    <span className="flex items-center gap-1 text-sm text-slate-600">
      <span className="stars" aria-hidden>
        {stars}
      </span>
      <span className="font-semibold text-slate-800">{formatRating(value, locale)}</span>
      {count !== undefined && (
        <span className="text-slate-400">
          ({count} {t('rating')})
        </span>
      )}
    </span>
  );
}
