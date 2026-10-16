# MehrWearingShopping (مهرویر)

A production-shaped **men's fashion e-commerce platform**: a Persian-first
storefront, an API-first backend that also serves mobile and desktop clients,
and a full admin console — in one TypeScript monorepo.

> Persian (fa-IR, RTL) is the primary language; English is a first-class
> second locale. Every URL is locale-prefixed (`/fa-IR/…`, `/en/…`) and every
> API record is bilingual, so switching language never costs a refetch.

---

## What's inside

**Storefront** (`apps/web` — Next.js 16, App Router)

- Home, catalog, category/brand pages, full-text search, faceted filters
  (size · color · brand · price · stock · discount) with sort and pagination
- Product detail with variants, gallery, specs, related items and reviews
- Guest cart → checkout with addresses, shipping methods, coupon codes
- Payment gateway redirect + return handling (success / failed / cancelled)
- Orders, tracking timeline, cancel / resume payment, wishlist, address book
- Account: profile, password change, order history
- Admin: revenue KPIs, order state machine, product/stock editor, review
  moderation
- i18n: fa-IR (default, RTL) and en, Persian digits, Jalali dates, ICU messages

**API** (`apps/api` — NestJS 12, Prisma 7, PostgreSQL)

- 52 OpenAPI-documented endpoints (`docs/openapi.json`, Swagger UI at
  `/api/docs`)
- JWT auth (short-lived access + rotating refresh), roles, guest carts
- Atomic stock reservation, coupons with limits, shipping rules
- Zarinpal payment provider + a built-in mock gateway for local dev
- Product search normalized for Persian (ZWNJ, diacritics, digits)

**Mobile starter** (`apps/mobile` — Expo 58)

- Catalog, product detail, cart, auth, fa/en switch — built on the _same_
  `@mehrwearing/api-client` package. See
  [`docs/mobile-integration.md`](docs/mobile-integration.md) for the mobile
  **and** desktop integration guide.

**Quality**

- 46 unit tests + 28 API e2e tests (self-provisioning throwaway database)
- Two smoke suites: full purchase journey against the API, and a BFF smoke
  that renders every storefront route with real session cookies
- Typecheck and lint across all four workspaces

---

## Tech stack

| Layer    | Choice                                                       |
| -------- | ------------------------------------------------------------ |
| Frontend | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4 |
| i18n     | next-intl 4 (locale-prefixed routing, RTL-first)             |
| Backend  | NestJS 12, Prisma 7, PostgreSQL 17, class-validator, Swagger |
| Client   | `@mehrwearing/api-client` — isomorphic typed `fetch` client  |
| Mobile   | Expo 58, expo-router, react-native-svg, expo-secure-store    |
| Tooling  | Bun workspaces, TypeScript 5.9, ESLint 9, Prettier, Jest 30  |

---

## Architecture at a glance

```
        ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
        │  Web store   │   │ Mobile (Expo)│   │ Desktop app  │
        │  Next.js 16  │   │  starter in  │   │ (any Node/RN)│
        └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
               │ BFF (httpOnly    │ Bearer token      │ Bearer token
               │ cookies)         │ + secure storage  │
               ▼                  └─────────┬─────────┘
        ┌──────────────┐                    │
        │  Next.js     │                    │
        │  server      │                    │
        │  actions/RSC │                    │
        └──────┬───────┘                    │
               └───────────────┬────────────┘
                               ▼
                    ┌─────────────────────┐
                    │  NestJS REST API    │  /api/v1  · OpenAPI /api/docs
                    │  auth · catalog ·   │
                    │  cart · orders ·    │
                    │  payments · admin   │
                    └──────────┬──────────┘
                               ▼
                        PostgreSQL (Prisma)
```

The storefront never exposes the API to the browser: it is a **BFF** — tokens
live in httpOnly cookies, all fetches happen on the server. Mobile and desktop
use the shared client directly with a Bearer token. Details in
[`docs/architecture.md`](docs/architecture.md).

---

## Quick start

```bash
git clone <your-repo-url> MehrWearingShopping
cd MehrWearingShopping

bun run setup        # deps, .env files, local PostgreSQL, migrations, seed

bun run dev          # API http://localhost:4000 · store http://localhost:3000
```

Seeded accounts:

| Role     | Email                  | Password            |
| -------- | ---------------------- | ------------------- |
| Admin    | `admin@mehrwearing.ir` | `ChangeMe!Admin123` |
| Customer | `demo@mehrwearing.ir`  | `Demo@12345`        |

Prefer to do it by hand? Everything `scripts/setup.sh` does is listed in
[`docs/deployment.md`](docs/deployment.md#local-development).

### Verify

```bash
bun run typecheck        # api-client → api → web → mobile
bun run test             # 46 unit tests
bun run test:e2e         # 28 API e2e tests (provisions its own DB)
bun run lint
bun run build            # all three build targets

# with API + store running:
bun run smoke            # full purchase journey against the API
bun run smoke:web        # every storefront route, incl. signed-in pages
```

---

## Repository layout

```
MehrWearingShopping/
├── apps/
│   ├── api/          NestJS REST API (Prisma, OpenAPI, Swagger UI)
│   ├── web/          Next.js storefront (fa-IR RTL default + English)
│   └── mobile/       Expo starter (catalog, product, cart, auth)
├── packages/
│   └── api-client/   Isomorphic typed client shared by every client app
├── docs/
│   ├── openapi.json  Generated OpenAPI contract (52 paths)
│   ├── architecture.md
│   ├── api.md
│   ├── deployment.md
│   └── mobile-integration.md
├── scripts/          setup.sh · smoke-api.sh · smoke-web.sh
└── tsconfig.base.json
```

---

## Documentation

| Document                                                   | What it covers                       |
| ---------------------------------------------------------- | ------------------------------------ |
| [`docs/architecture.md`](docs/architecture.md)             | System design, auth, cart, i18n      |
| [`docs/api.md`](docs/api.md)                               | Endpoint reference and conventions   |
| [`docs/deployment.md`](docs/deployment.md)                 | Environment, hosting, CI/CD, runbook |
| [`docs/mobile-integration.md`](docs/mobile-integration.md) | Mobile & desktop integration guide   |
| `docs/openapi.json` / `http://localhost:4000/api/docs`     | Machine contract + interactive docs  |

---

## License

MIT — see [`LICENSE`](LICENSE).
