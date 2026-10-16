'use client';

import { useTranslations } from 'next-intl';

/**
 * Maps the API's machine-readable error codes onto localized copy.
 * Falls back to the generic message for codes the catalogue does not know.
 */
export function ApiErrorText({ code }: { code: string }) {
  const t = useTranslations('apiErrors');
  if (code && t.has(code)) return <>{t(code)}</>;
  return <>{t('GENERIC')}</>;
}
