'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { changePasswordAction } from '@/actions/account';
import { ApiErrorText } from './api-error';

/** Change-password form; the API revokes all refresh tokens on success. */
export function PasswordForm() {
  const t = useTranslations('account');
  const tc = useTranslations('common');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError(null);
    startTransition(async () => {
      const result = await changePasswordAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(true);
      form.reset();
    });
  }

  return (
    <section className="card p-5">
      <h2 className="mb-4 text-lg font-extrabold text-slate-900">{t('changePassword')}</h2>

      {done && (
        <p className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          ✓ {tc('saved')}
        </p>
      )}

      <form onSubmit={submit} className="grid max-w-md gap-4">
        <div>
          <label className="label" htmlFor="currentPassword">
            {t('currentPassword')}
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            required
            minLength={8}
            autoComplete="current-password"
            dir="ltr"
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="newPassword">
            {t('newPassword')}
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            dir="ltr"
            className="input"
          />
        </div>

        {error && (
          <p className="text-sm font-bold text-red-600">
            <ApiErrorText code={error} />
          </p>
        )}

        <button type="submit" disabled={pending} className="btn btn-primary w-fit">
          {t('changePassword')}
        </button>
      </form>
    </section>
  );
}
