'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { toggleWishlistAction } from '@/actions/account';
import { ApiErrorText } from './api-error';

/** Heart toggle used on product pages; state is server-derived on mount. */
export function WishlistButton({
  productId,
  initialActive,
}: {
  productId: string;
  initialActive: boolean;
}) {
  const t = useTranslations('product');
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleWishlistAction(productId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setActive((value) => !value);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`btn btn-outline ${active ? 'border-red-300 text-red-600' : ''}`}
        aria-pressed={active}
      >
        <span aria-hidden>{active ? '♥' : '♡'}</span>
        {active ? t('wished') : t('wishlist')}
      </button>
      {error && (
        <span className="text-xs font-semibold text-red-600">
          <ApiErrorText code={error} />
        </span>
      )}
    </span>
  );
}
