# MehrWearingShopping — mobile starter (Expo)

The reference client for phones. It is intentionally thin: every piece of
commerce logic — catalog, cart, coupons, orders, payments, moderation — lives
in the API, and this app is a presentation layer over the **same**
`@mehrwearing/api-client` package the storefront and any desktop client use.

```
src/
├── app/                  # expo-router screens
│   ├── _layout.tsx       # providers (i18n → session → cart) + native stack
│   ├── index.tsx         # catalog: search, categories, product grid
│   ├── product/[slug].tsx# detail: gallery, variants, add-to-cart, related
│   ├── cart.tsx          # cart lines, quantity steppers, subtotal
│   ├── login.tsx         # sign in / register
│   └── account.tsx       # profile, language switch, sign out
├── components/           # shared UI (SVG product image)
└── lib/
    ├── api.ts            # single createApiClient() instance + token storage
    ├── storage.ts        # SecureStore (native) / localStorage (web)
    ├── i18n.tsx          # Persian-first dictionaries, RTL, formatters
    └── state.tsx         # session + cart providers
```

## Run it

```bash
# from the repository root
bun install
bun run build:client        # the shared client must be built once
bun run db:start            # local PostgreSQL (leave running)
bun run db:migrate && bun run db:seed
bun run dev:api             # API on :4000

# then, in another shell:
cd apps/mobile
bun run typecheck
bun run start               # Expo dev server → press i / a, or scan the QR
```

Configure the API origin in `apps/mobile/.env` (copy `.env.example`):

| Where you run it            | `EXPO_PUBLIC_API_URL`            |
| --------------------------- | -------------------------------- |
| iOS simulator / Expo web    | `http://localhost:4000/api/v1`   |
| Android emulator            | `http://10.0.2.2:4000/api/v1`    |
| Physical device on your LAN | `http://192.168.x.x:4000/api/v1` |

The API must allow your origin: set `CORS_ORIGINS` in `apps/api/.env`.

## How it talks to the backend

- **One client, no duplicated HTTP code.** `src/lib/api.ts` calls
  `createApiClient()` with `getToken`, `getCartId`, `onTokens`, `onCartId` —
  the client is pure `fetch`, so it behaves identically in React Native,
  browsers and Node (desktop).
- **Tokens live in the Keychain/Keystore** via `expo-secure-store`, never in
  plain AsyncStorage.
- **Guest carts work without an account**: the API issues a cart id, the
  client persists it, and it rides every request as `x-cart-id`.
- **Every response is bilingual** (`nameFa`/`nameEn`, …), so switching
  language is instant and needs no refetch. Persian (RTL) is the default;
  the direction is applied on the next cold start after a switch.

## Deliberate scope cuts

The starter proves the integration; it does not re-implement the whole
storefront:

- **Checkout and payments stay on the web** — addresses, coupons and the
  gateway redirect are already covered by the BFF, so the app links into it
  instead of forking that logic. The same `orders.place/pay` client methods
  are available if you want in-app checkout later.
- **Admin tooling is web-only** (see `/admin` in the storefront).
- **Token refresh** is handled by the API's `/auth/refresh`; wire it into the
  client's `getToken` hook when you add long-lived sessions.

## Production build

```bash
bunx eas build --platform android   # or --platform ios / --platform all
bunx eas submit --platform android
```

`app.json` holds the app identity (name, scheme, icons, splash). Set
`EXPO_PUBLIC_API_URL` to your deployed API before building.
