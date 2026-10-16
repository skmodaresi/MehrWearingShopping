'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import type { Address, Cart, CouponPreview } from '@mehrwearing/api-client';
import { checkoutAction, validateCouponAction } from '@/actions/checkout';
import { formatPrice } from '@/lib/format';
import { AddressForm } from './address-form';
import { ApiErrorText } from './api-error';

/**
 * The whole checkout surface: address picker (+ inline new address), shipping
 * method, coupon code and the final "place order & pay" submit, which ends
 * with a full-page redirect to the payment gateway.
 */
export function CheckoutPanel({
  locale,
  cart,
  addresses,
}: {
  locale: string;
  cart: Cart;
  addresses: Address[];
}) {
  const t = useTranslations('checkout');
  const tCart = useTranslations('cart');
  const router = useRouter();

  const [addressId, setAddressId] = useState<string | null>(
    addresses.find((address) => address.isDefault)?.id ?? addresses[0]?.id ?? null,
  );
  const [shipping, setShipping] = useState<'STANDARD' | 'EXPRESS'>('STANDARD');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<CouponPreview | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(addresses.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function applyCoupon() {
    if (!couponInput.trim()) return;
    setCouponError(null);
    startTransition(async () => {
      const { preview, error: couponErrorCode } = await validateCouponAction(
        couponInput.trim(),
        cart.subtotalToman,
      );
      if (couponErrorCode || !preview) {
        setCoupon(null);
        setCouponError(couponErrorCode ?? 'GENERIC');
        return;
      }
      setCoupon(preview);
    });
  }

  function placeOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!addressId) return;
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set('addressId', addressId);
    formData.set('shippingMethod', shipping);
    if (coupon) formData.set('couponCode', coupon.code);
    formData.set('locale', locale);

    startTransition(async () => {
      const result = await checkoutAction(formData);
      if (result.error || !result.gatewayUrl) {
        setError(result.error ?? 'GENERIC');
        return;
      }
      // Full navigation: the gateway page lives on the API origin.
      window.location.assign(result.gatewayUrl);
    });
  }

  const payable = cart.subtotalToman - (coupon?.discountToman ?? 0);

  return (
    <form onSubmit={placeOrder} className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-6">
        {/* address */}
        <section className="card p-5">
          <h2 className="mb-4 text-lg font-extrabold text-slate-900">{t('address')}</h2>

          {addresses.length > 0 && (
            <div className="mb-4 flex flex-col gap-2">
              {addresses.map((address) => (
                <label
                  key={address.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${
                    addressId === address.id
                      ? 'border-slate-900 bg-slate-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="address"
                    checked={addressId === address.id}
                    onChange={() => setAddressId(address.id)}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-bold text-slate-900">
                      {address.label ?? address.city}
                      {address.isDefault && <span className="badge badge-accent ms-2">★</span>}
                    </span>
                    <span className="mt-0.5 block text-slate-500">
                      {address.recipientName} — {address.addressLine}, {address.city}
                    </span>
                    <bdi className="mt-0.5 block text-xs text-slate-400">
                      {address.phone} · {address.postalCode}
                    </bdi>
                  </span>
                </label>
              ))}
            </div>
          )}

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setShowAddressForm((value) => !value)}
          >
            {t('newAddress')}
          </button>

          {showAddressForm && (
            <div className="mt-4">
              <AddressForm
                compact
                onSaved={(id) => {
                  setAddressId(id);
                  setShowAddressForm(false);
                  router.refresh();
                }}
              />
            </div>
          )}
        </section>

        {/* shipping */}
        <section className="card p-5">
          <h2 className="mb-4 text-lg font-extrabold text-slate-900">{t('shipping')}</h2>
          <div className="flex flex-col gap-2">
            {(['STANDARD', 'EXPRESS'] as const).map((method) => (
              <label
                key={method}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-semibold transition ${
                  shipping === method
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="shippingMethod"
                  checked={shipping === method}
                  onChange={() => setShipping(method)}
                />
                {t(method === 'STANDARD' ? 'standard' : 'express')}
              </label>
            ))}
          </div>
        </section>

        {/* note */}
        <section className="card p-5">
          <label className="label" htmlFor="note">
            {t('note')}
          </label>
          <textarea id="note" name="note" rows={2} className="input resize-none" maxLength={300} />
        </section>
      </div>

      {/* summary */}
      <aside className="card sticky top-32 p-5">
        <h2 className="mb-4 text-lg font-extrabold text-slate-900">{t('summary')}</h2>

        <ul className="mb-4 max-h-56 space-y-3 overflow-y-auto text-sm">
          {cart.items
            .filter((item) => item.available)
            .map((item) => (
              <li key={item.variantId} className="flex justify-between gap-3">
                <span className="text-slate-600">
                  {locale === 'fa-IR' ? item.product.nameFa : item.product.nameEn}
                  <span className="text-slate-400"> × {item.qty}</span>
                </span>
                <span className="font-semibold">{formatPrice(item.lineTotalToman, locale)}</span>
              </li>
            ))}
        </ul>

        {/* coupon */}
        <div className="mb-4 flex gap-2">
          <input
            value={couponInput}
            onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
            placeholder={t('coupon')}
            dir="ltr"
            className="input"
          />
          <button
            type="button"
            onClick={applyCoupon}
            disabled={pending}
            className="btn btn-outline shrink-0"
          >
            {t('couponApply')}
          </button>
        </div>
        {couponError && (
          <p className="mb-3 text-xs font-semibold text-red-600">
            <ApiErrorText code={couponError} />
          </p>
        )}
        {coupon && (
          <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
            ✓ {coupon.code} — {formatPrice(coupon.discountToman, locale)}
          </p>
        )}

        <dl className="space-y-2 border-t border-slate-100 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">{tCart('subtotal')}</dt>
            <dd className="font-semibold">{formatPrice(cart.subtotalToman, locale)}</dd>
          </div>
          {coupon && coupon.discountToman > 0 && (
            <div className="flex justify-between text-green-700">
              <dt>{tCart('discount')}</dt>
              <dd className="font-semibold">− {formatPrice(coupon.discountToman, locale)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-extrabold">
            <dt>{tCart('totalPayable')}</dt>
            <dd>{formatPrice(payable, locale)}</dd>
          </div>
        </dl>

        {error && (
          <p className="mt-3 text-sm font-semibold text-red-600">
            <ApiErrorText code={error} />
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !addressId || cart.itemCount === 0}
          className="btn btn-accent mt-4 w-full"
        >
          {pending ? t('placing') : t('payNow')}
        </button>

        {!addressId && !showAddressForm && (
          <p className="mt-2 text-xs font-semibold text-orange-600">{t('selectAddress')}</p>
        )}

        <p className="mt-3 text-center text-xs text-slate-400">
          <Link href={`/${locale}/cart`} className="underline">
            {tCart('continueShopping')}
          </Link>
        </p>
      </aside>
    </form>
  );
}
