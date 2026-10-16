'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { saveAddressAction } from '@/actions/account';
import { ApiErrorText } from './api-error';

/**
 * Address form used in checkout (inline) and on the account page.
 * Submits through the server action and reports the created id via `onSaved`
 * so checkout can immediately select the new address.
 */
export function AddressForm({
  onSaved,
  compact = false,
}: {
  onSaved?: (addressId: string) => void;
  compact?: boolean;
}) {
  const t = useTranslations('checkout');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await saveAddressAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.id && onSaved) onSaved(result.id);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className={`grid gap-4 ${compact ? '' : 'card p-5 sm:grid-cols-2'}`}>
      <div>
        <label className="label" htmlFor="recipientName">
          {t('recipient')}
        </label>
        <input id="recipientName" name="recipientName" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="phone">
          {t('phone')}
        </label>
        <input
          id="phone"
          name="phone"
          required
          dir="ltr"
          placeholder="09123456789"
          className="input"
        />
      </div>
      <div>
        <label className="label" htmlFor="province">
          {t('province')}
        </label>
        <input id="province" name="province" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="city">
          {t('city')}
        </label>
        <input id="city" name="city" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="postalCode">
          {t('postalCode')}
        </label>
        <input
          id="postalCode"
          name="postalCode"
          required
          dir="ltr"
          inputMode="numeric"
          pattern="[0-9]{10}"
          maxLength={10}
          className="input"
        />
      </div>
      <div>
        <label className="label" htmlFor="label">
          {t('label')}
        </label>
        <input id="label" name="label" className="input" placeholder="خانه" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="addressLine">
          {t('addressLine')}
        </label>
        <textarea
          id="addressLine"
          name="addressLine"
          required
          rows={2}
          className="input resize-none"
        />
      </div>

      {error && (
        <p className="text-sm font-semibold text-red-600 sm:col-span-2">
          <ApiErrorText code={error} />
        </p>
      )}

      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? '…' : t('saveAddress')}
        </button>
      </div>
    </form>
  );
}
