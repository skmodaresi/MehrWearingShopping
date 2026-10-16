# Architecture

How MehrWearingShopping is put together and why. Read this before changing a
cross-cutting concern (auth, cart, i18n, data shapes).

---

## 1. Guiding decisions

### API-first, one client package

The API is the product. `packages/api-client` is typed against the generated
contract in `docs/openapi.json` and is pure `fetch`, so the same object runs
in:

- the Next.js storefront (server components and server actions),
- the Expo starter (React Native + web),
- any desktop shell (Electron, Tauri, or plain Node).

`docs/openapi.json` is generated from the NestJS code (`bun run openapi`), so
the contract can't drift from the implementation unnoticed.

### The storefront is a BFF

The browser never calls the API directly:

- access/refresh tokens are **httpOnly cookies** written only by server
  actions,
- every request to the API is proxied through server components / actions in
  `apps/web/src/lib/api.ts`,
- no CORS for the store, no token in `localStorage`, XSS can't read the
  session.

Mobile and desktop can't use cookies the same way, so they use
`Authorization: Bearer` + secure storage. Both paths are the same code path
in the client package (`getToken`, `onTokens` hooks).

### Bilingual records, not negotiated ones

Every catalog record stores both languages (`nameFa`/`nameEn`,
`descriptionFa`/`descriptionEn`, …) and both are returned in one payload.
The client picks a column at render time:

- one cache entry serves both locales,
- language switch is instant (no refetch, no flash),
- editors always see the full record.

Free-text search uses a normalized `searchText` column so «تی‌شرت»,
«تی شرت» and «تي شرت» all match (see `apps/api/src/common/utils/persian.ts`).

### Money and time are integers and instants

Prices are **integer Toman** everywhere (`priceToman`), formatted only at the
edges (`formatPrice` in web/mobile). Dates are ISO strings; formatting picks
Jalali (`fa-IR-u-ca-persian`) or Gregorian by locale.

---

## 2. Workspaces

| Workspace             | Responsibility                               |
| --------------------- | -------------------------------------------- |
| `apps/api`            | HTTP, business rules, persistence, OpenAPI   |
| `apps/web`            | Rendering, SEO, session cookies, admin UI    |
| `apps/mobile`         | Reference native client                      |
| `packages/api-client` | Wire types + typed client for every consumer |

Bun workspaces link them locally: the store and the app depend on
`@mehrwearing/api-client: "*"` and always compile against the source of
truth.

---

## 3. Request paths

### Storefront page (anonymous)

```
GET /fa-IR/p/oxford-shirt
 └─ proxy.ts (next-intl)      → ensures the /fa-IR prefix
 └─ app/[locale]/layout.tsx   → categories + session cookie + shell
 └─ p/[slug]/page.tsx         → GET /api/v1/products/:slug  (server fetch)
                                x-locale: fa-IR, x-cart-id (if present)
 └─ streamed HTML (RTL, fa copy, both languages available for the switch)
```

### Storefront mutation (server action)

```
Add to cart (client)
 └─ actions/cart.ts  [use server]
     ├─ cookie: mws_access  → Authorization: Bearer …
     ├─ cookie: mws_cart    → x-cart-id: …
     ├─ POST /api/v1/cart/items
     ├─ API reserves stock, returns the cart
     └─ revalidatePath('/', 'layout')  → header badge updates
```

### Mobile

```
app/index.tsx → api.catalog.products()
 └─ getToken()   → Bearer from expo-secure-store
 └─ getCartId()  → guest cart id persisted after the first call
 └─ onTokens()   → writes Keychain/Keystore on login
```

---

## 4. Authentication & sessions

| Concern         | Web (BFF)                                | Mobile / desktop                  |
| --------------- | ---------------------------------------- | --------------------------------- |
| Access token    | `mws_access` httpOnly, 15 min            | `expo-secure-store` / OS keychain |
| Refresh token   | `mws_refresh` httpOnly, 7 d, rotated     | same, rotated by `auth.refresh`   |
| Display profile | `mws_user` (non-httpOnly, never trusted) | in-memory after `auth.me()`       |
| Guest cart      | `mws_cart` cookie                        | persisted cart id                 |
| Authorization   | always re-checked by the API             | always re-checked by the API      |

Roles: `ADMIN` and `CUSTOMER`. Guards live in the API
(`RolesGuard` + `@Roles('ADMIN')`); the storefront's `/admin` layout guard is
UX only and says so in a comment.

Refresh flow: the layout detects "no access cookie but a refresh cookie" and
the client calls `refreshSessionAction()` once on mount, rotating tokens
server-side and re-rendering the view.

---

## 5. Cart & checkout

- **Guest carts are first-class.** `GET /cart` creates one and the API echoes
  `x-cart-id`; the client persists it. When a guest signs in, the API merges
  the guest cart into the user's cart.
- **Stock is reserved atomically** when the order is placed
  (`POST /orders`), not when it is paid, and released on cancel — the unit
  tests cover the reservation math.
- **Checkout is one server round-trip**: `POST /orders` then
  `POST /orders/:n/pay`, then the browser is redirected to the gateway. The
  gateway returns to
  `{WEB_BASE_URL}/{locale}/order/{orderNumber}?payment=success|failed|cancelled`,
  which is why the order page is both the confirmation and the return target.
- **Coupons** are validated server-side (`POST /coupons/validate`) with type,
  expiry, usage cap and minimum-order rules; the UI only previews.

---

## 6. State machine (orders)

```
PENDING ──pay──▶ PAID ──▶ PROCESSING ──▶ SHIPPED ──▶ DELIVERED
   │               │
   └──cancel──▶ CANCELLED        refunded ──▶ REFUNDED
```

Transitions are enforced in `orders.service.ts`; the admin UI only offers
legal next states, and the API rejects everything else.

---

## 7. Internationalization & direction

- `proxy.ts` (Next 16's middleware) keeps every URL locale-prefixed and sends
  `/` → `/fa-IR`.
- `<html lang dir>` is set from the locale; Tailwind logical properties
  (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) mean one CSS file serves both
  directions.
- The app's navigation helpers (`apps/web/src/i18n/navigation.tsx`) normalize
  explicit `/${locale}/…` hrefs before delegating to next-intl, which adds the
  prefix itself — this is what prevents `/fa-IR/fa-IR/…` links.
- Messages live in `apps/web/messages/{fa-IR,en}.json`; `messages.spec.ts`
  fails the build if the two catalogues drift apart or a placeholder goes
  missing.

---

## 8. Failure handling

- API errors are a single envelope: `{ code, message, details? }` with stable
  machine codes (`OUT_OF_STOCK`, `COUPON_EXPIRED`, …).
- The client throws `ApiError`/`ServerApiError` carrying that code.
- The UI maps codes → localized copy (`apiErrors.*`), so a Persian shopper
  never sees an English stack trace.
- The layout renders even if the catalog API hiccups (categories fall back to
  an empty list); individual pages still fail loudly into `error.tsx`.

---

## 9. Testing strategy

| Layer            | Tool                   | What it proves                                        |
| ---------------- | ---------------------- | ----------------------------------------------------- |
| Units            | Jest                   | pricing, coupons, Persian normalization, auth, client |
| API e2e          | Jest + throwaway DB    | the real HTTP surface incl. admin & payment callbacks |
| Store smoke      | `scripts/smoke-api.sh` | full purchase journey end-to-end                      |
| Storefront smoke | `scripts/smoke-web.sh` | every route + signed-in BFF flows                     |
| Types            | `tsc --noEmit`         | all four workspaces, one command                      |

The e2e suite provisions its own PostgreSQL (`DATABASE_URL_TEST`) so it never
touches your development data.
