# Mobile & desktop integration

Everything a native or desktop client needs to talk to MehrWearingShopping.
The short version: **install `@mehrwearing/api-client`, point it at the API,
store the tokens somewhere safe, and render the bilingual records.**

A working reference lives in [`apps/mobile`](../apps/mobile) (Expo, catalog →
product → cart → auth → language switch). This document explains the pieces so
you can build the real app — or a desktop one — on the same foundation.

---

## 1. Why one client package

`packages/api-client` is pure `fetch` with zero DOM/Node/React Native
dependencies:

- works in React Native, Electron, Tauri's webview, a browser, or plain Node;
- one place that knows URLs, query serialization, the error envelope, the
  `x-cart-id` header and token refresh;
- wire types (`ProductCard`, `Order`, `Cart`, …) are shared with the web app,
  so a breaking API change fails `tsc` in every client at once.

```ts
import { createApiClient, ApiError } from '@mehrwearing/api-client';

const api = createApiClient({
  baseUrl: 'https://api.example.com/api/v1',
  getToken: () => tokenStore.access, // Bearer token
  getCartId: () => tokenStore.cartId, // guest cart id
  onTokens: (pair) => tokenStore.save(pair), // after login/refresh/logout
  onCartId: (id) => (tokenStore.cartId = id), // issued by GET /cart
  defaultHeaders: { 'x-locale': 'fa-IR' }, // orders record the language
});
```

The package must be **built once** before consuming apps compile:
`bun run build:client` (the repo's `typecheck` and `build` scripts do this).

---

## 2. Base URL

| Client           | Base URL                                         |
| ---------------- | ------------------------------------------------ |
| Web (BFF)        | server-side only, `http://127.0.0.1:4000/api/v1` |
| iOS simulator    | `http://localhost:4000/api/v1`                   |
| Android emulator | `http://10.0.2.2:4000/api/v1`                    |
| Physical device  | `http://<lan-ip>:4000/api/v1`                    |
| Production       | `https://api.example.com/api/v1`                 |

For Expo this is `EXPO_PUBLIC_API_URL` (see `apps/mobile/.env.example`).
These values are baked into the binary and are **public** — never put secrets
in them.

The API only needs `CORS_ORIGINS` for browser-based clients; native apps send
no `Origin` header and work out of the box.

---

## 3. Authentication

The API issues a **short-lived access token** (15 min) and a **refresh token**
(7 days). Store both:

| Platform      | Where                                                                        |
| ------------- | ---------------------------------------------------------------------------- |
| iOS / Android | `expo-secure-store` → Keychain / Keystore (`apps/mobile/src/lib/storage.ts`) |
| Electron      | `safeStorage` (OS keychain-backed)                                           |
| Tauri         | the OS keyring plugin                                                        |
| Browser (SPA) | prefer the BFF instead — see the storefront                                  |

```ts
const auth = await api.auth.login({ email, password });
// onTokens() already persisted them through your hooks

const me = await api.auth.me(); // → Bearer added automatically

// later, on 401:
try {
  await api.auth.refresh(refreshToken); // rotates the pair
} catch {
  await api.auth.logout(refreshToken).catch(() => {});
  // → send the user to sign in
}
```

Rules that keep you safe:

- never log tokens, never put them in analytics, never ship them to a web
  `localStorage` if you can avoid it;
- treat `role` from `/auth/me` as **display data** — the API re-checks every
  admin route regardless;
- `POST /users/me/password` revokes **all** refresh tokens, so be ready to
  re-authenticate every device.

---

## 4. Carts: guests first

You do not need an account to shop:

```ts
const cart = await api.cart.get(); // API creates a guest cart,
// onCartId() fires with its id
await api.cart.addItem(variantId, 2);
```

Persist the cart id (it is just an opaque string) and return it on every
request via `getCartId()`. When the user signs in, the API merges the guest
cart into their account cart — no client work required.

**Checkout** is intentionally server-driven: `api.orders.place(...)` reserves
stock, then `api.orders.pay(orderNumber)` returns a `gatewayUrl` you open in a
browser/WebView; the gateway redirects to
`{WEB_BASE_URL}/{locale}/order/{orderNumber}?payment=…`.

The mobile starter keeps checkout in the storefront (addresses, coupons and
the redirect already exist there). If you want in-app checkout, the two calls
above plus your own address form are enough — validate the coupon first with
`api.coupons.validate(code, subtotalToman)`.

---

## 5. Two languages, one payload

Every catalog row carries both languages (`nameFa`/`nameEn`,
`descriptionFa`/`descriptionEn`, `category.nameFa`/`category.nameEn`, …):

```ts
const name = locale === 'fa-IR' ? product.nameFa : product.nameEn;
```

- default locale is **fa-IR (RTL)**; `en` is LTR;
- switching language is a re-render, **not** a refetch;
- direction: `I18nManager.allowRTL(true)` + `forceRTL(isFa)` at startup
  (React Native applies it on the next cold start — the starter tells the user
  to restart once);
- prices are integer Toman — format with `Intl.NumberFormat('fa-IR')` for
  Persian digits and `fa-IR-u-ca-persian` for Jalali dates;
- pass `x-locale` (the client's `defaultHeaders`) so orders record which
  language the shopper used.

Error codes are stable strings (`OUT_OF_STOCK`, `COUPON_EXPIRED`, …): map
them to your own copy, don't translate `message`.

---

## 6. Images

The catalog stores SVG artwork (`/images/products/*.svg`) so one asset serves
every density. React Native's `Image` can't decode SVG — the starter renders
it with `react-native-svg`'s `<SvgUri>` (`apps/mobile/src/components/product-image.tsx`),
resolving the root-relative path against the API **origin** (`assetUrl()`).

If you'd rather ship raster, add a resize/CDN step in front of `/images` and
store absolute URLs; `assetUrl()` passes `http(s)` URLs through untouched.

---

## 7. Desktop

Two good options, both using the same client:

**Electron / Tauri with a web view of the storefront** — fastest path, zero
reimplementation: point the window at `https://example.com`, the BFF session
cookies work as-is inside the webview.

**A native-feeling desktop client (recommended for a real app)**

```ts
// main or renderer, depending on your split
const api = createApiClient({
  baseUrl: process.env.API_BASE_URL,
  getToken: () => safeStorage.decrypt('access'),
  onTokens: (pair) => pair && safeStorage.store('access', pair.accessToken),
});

// …same calls as everywhere else:
const { items } = await api.catalog.products({ sort: 'bestseller', limit: 24 });
```

Practical notes:

- desktop is a browser origin → add it to `CORS_ORIGINS`
  (`http://localhost:5173` in dev, your app scheme in prod);
- keep the window's `webSecurity` on; don't disable the context isolation to
  make a call work;
- auto-update and code signing are packaging concerns — the API contract is
  unaffected;
- for a terminal/ops tool, the same package runs in plain Node with the global
  `fetch` (Node ≥ 18).

---

## 8. Checklist before shipping a client

- [ ] `bun run build:client` in CI so types are current
- [ ] tokens in secure storage, refresh on 401, logout on refresh failure
- [ ] cart id persisted; guest cart works signed out
- [ ] `x-locale` sent; both languages rendered from one payload
- [ ] RTL verified for fa (and LTR for en) — text alignment, icons, back arrows
- [ ] every API error `code` mapped to localized copy
- [ ] product images resolved through `assetUrl()`
- [ ] deep links into product/order pages (`/p/{slug}`, `/order/{number}`)
- [ ] offline/empty/loading states for each list screen
- [ ] API base URL configurable per environment (dev/staging/prod)
