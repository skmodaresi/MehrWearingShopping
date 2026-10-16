'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Route error boundary. Renders localized copy (never a raw stack) and offers
 * a retry that re-runs the failed segment.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common');

  useEffect(() => {
    console.error('[web] route error', error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-red-50 text-3xl">⚠️</span>
      <h1 className="text-2xl font-extrabold text-slate-900">{t('error')}</h1>
      <p className="text-sm text-slate-500">{error.digest ? <bdi>{error.digest}</bdi> : null}</p>
      <button type="button" onClick={reset} className="btn btn-primary">
        {t('retry')}
      </button>
    </div>
  );
}
