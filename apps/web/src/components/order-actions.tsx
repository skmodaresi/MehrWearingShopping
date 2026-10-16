'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { cancelOrderAction, payOrderAction } from '@/actions/account';
import { ApiErrorText } from './api-error';

/** Cancel button for unpaid orders (the API enforces the state machine). */
export function CancelOrderButton({
  orderNumber,
  locale,
}: {
  orderNumber: string;
  locale: string;
}) {
  const t = useTranslations('order');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function cancel() {
    if (!window.confirm(t('cancelConfirm'))) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelOrderAction(orderNumber, locale);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={cancel}
        disabled={pending}
        className="btn btn-outline text-red-600"
      >
        {t('cancel')}
      </button>
      {error && (
        <span className="text-xs font-semibold text-red-600">
          <ApiErrorText code={error} />
        </span>
      )}
    </span>
  );
}

/** "Pay now" for an order that is still PENDING — restarts the gateway flow. */
export function PayOrderButton({ orderNumber }: { orderNumber: string }) {
  const t = useTranslations('order');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pay() {
    setError(null);
    startTransition(async () => {
      const result = await payOrderAction(orderNumber);
      if (result.error || !result.gatewayUrl) {
        setError(result.error ?? 'GENERIC');
        return;
      }
      window.location.assign(result.gatewayUrl);
    });
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={pay} disabled={pending} className="btn btn-accent">
        {t('payNow')}
      </button>
      {error && (
        <span className="text-xs font-semibold text-red-600">
          <ApiErrorText code={error} />
        </span>
      )}
    </span>
  );
}
