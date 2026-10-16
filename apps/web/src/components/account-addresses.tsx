'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Address } from '@mehrwearing/api-client';
import { deleteAddressAction } from '@/actions/account';
import { AddressForm } from './address-form';
import { ApiErrorText } from './api-error';

/** Saved addresses list with an inline add form and removal. */
export function AccountAddresses({ addresses }: { addresses: Address[] }) {
  const t = useTranslations('account');
  const [showForm, setShowForm] = useState(addresses.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function remove(addressId: string) {
    setError(null);
    setPending(true);
    void deleteAddressAction(addressId).then((result) => {
      setPending(false);
      if (result.error) setError(result.error);
    });
  }

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-slate-900">{t('addresses')}</h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn btn-outline btn-sm"
          >
            {t('addAddress')}
          </button>
        )}
      </div>

      {addresses.length === 0 && !showForm && (
        <p className="text-sm text-slate-500">{t('noAddresses')}</p>
      )}

      <div className="flex flex-col gap-3">
        {addresses.map((address) => (
          <div key={address.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-slate-900">
                {address.label ?? address.city}
                {address.isDefault && (
                  <span className="badge badge-accent ms-2">{t('default')}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => remove(address.id)}
                disabled={pending}
                className="text-xs font-bold text-slate-400 hover:text-red-600"
              >
                {t('delete')}
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {address.recipientName} — {address.addressLine}, {address.city}, {address.province}
            </p>
            <bdi className="mt-1 block text-xs text-slate-400">
              {address.phone} · {address.postalCode}
            </bdi>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-3 text-sm font-bold text-red-600">
          <ApiErrorText code={error} />
        </p>
      )}

      {showForm && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <AddressForm compact onSaved={() => setShowForm(false)} />
          {addresses.length > 0 && (
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn btn-ghost mt-2 text-sm"
            >
              {t('title')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
