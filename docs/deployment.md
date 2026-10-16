# Deployment

From a laptop to a public URL. The stack is deliberately boring: two Node
processes, one PostgreSQL, one reverse proxy.

---

## 1. Local development

```bash
bun install                    # Bun ≥ 1.3, Node ≥ 20.19
bun run setup                  # .env files + PostgreSQL + migrations + seed
bun run dev                    # API :4000 and storefront :3000 together
```

`bun run setup` (i.e. `scripts/setup.sh`) is idempotent — re-running it keeps
existing `.env` files and an already-running database.

Individual commands:

```bash
bun run db:start               # embedded PostgreSQL 17 on 127.0.0.1:5433
bun run db:migrate             # prisma migrate dev
bun run db:seed                # catalog + demo users + admin
bun run db:studio              # Prisma Studio
bun run dev:api                 # API only (watch)
bun run dev:web                 # storefront only (watch)
bun run dev:mobile              # Expo starter
```

---

## 2. Environment

### `apps/api/.env` (from `.env.example`)

| Variable                                                                       | Purpose                                                   | Production value                                            |
| ------------------------------------------------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------- |
| `NODE_ENV`                                                                     | mode                                                      | `production`                                                |
| `PORT`                                                                         | listen port                                               | `4000` (or behind the proxy)                                |
| `API_BASE_URL`                                                                 | public URL of the API (Swagger server + gateway callback) | `https://api.example.com`                                   |
| `WEB_BASE_URL`                                                                 | public URL of the store (post-payment redirect)           | `https://example.com`                                       |
| `CORS_ORIGINS`                                                                 | allowed browser origins (mobile/desktop don't need it)    | `https://example.com`                                       |
| `DATABASE_URL`                                                                 | PostgreSQL connection string                              | managed DB URL                                              |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`                                     | signing keys                                              | `openssl rand -base64 48` each                              |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL`                                           | token lifetimes                                           | `15m` / `7d`                                                |
| `SHIPPING_STANDARD_COST` / `SHIPPING_EXPRESS_COST` / `FREE_SHIPPING_THRESHOLD` | shipping rules                                            | business values                                             |
| `PAYMENT_PROVIDER`                                                             | `mock` or `zarinpal`                                      | `zarinpal`                                                  |
| `ZARINPAL_MERCHANT_ID`                                                         | gateway credentials                                       | from your gateway                                           |
| `ZARINPAL_CALLBACK_URL`                                                        | gateway return URL                                        | `https://api.example.com/api/v1/payments/zarinpal/callback` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`                                     | seed admin                                                | change before seeding, then delete                          |

**Never commit `.env`** — it is git-ignored; only `.env.example` is tracked.

### `apps/web/.env`

| Variable               | Purpose                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `API_BASE_URL`         | server-side API base, e.g. `http://127.0.0.1:4000/api/v1` (the browser never uses it) |
| `NEXT_PUBLIC_SITE_URL` | canonical origin, used for metadata and payment returns                               |

### `apps/mobile/.env`

| Variable              | Purpose                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | API base baked into the binary — **public**, so never put secrets here |

---

## 3. Build

```bash
bun run typecheck      # api-client → api → web → mobile
bun run test           # unit tests
bun run test:e2e       # API tests (needs a reachable test database)
bun run build          # packages/api-client → apps/api → apps/web
```

Artifacts:

- `apps/api/dist/` — NestJS bundle, run with `node apps/api/dist/main.js`
- `apps/web/.next/` — Next.js production build, run with `next start`
- `packages/api-client/dist/` — imported by both apps at runtime

---

## 4. Database

```bash
# migrations are committed under apps/api/prisma/migrations
bun run db:deploy       # prisma migrate deploy — production (no prompts)
bun run db:seed         # optional demo catalog; skip in real shops
```

Run migrations **before** starting the new code (roll forward only). Back up
with `pg_dump` on a schedule; restore by loading the dump into a fresh
database and pointing `DATABASE_URL` at it.

---

## 5. Hosting options

### A. Single VPS (simplest, fully reproducible)

```bash
# 1. code
git clone <repo> /opt/mehrwearing && cd /opt/mehrwearing
bun install
cp apps/api/.env.example apps/api/.env    # then edit real values
cp apps/web/.env.example apps/web/.env
bun run build
bun run db:deploy

# 2. process manager
npm i -g pm2
pm2 start apps/api/dist/main.js --name mws-api -i 1
cd apps/web && pm2 start "npx next start -p 3000" --name mws-web
pm2 save && pm2 startup
```

Nginx in front (TLS + proxying):

```nginx
server {
  listen 443 ssl http2;
  server_name example.com;

  # storefront
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # API — either on a subdomain, or under a path prefix:
  location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

If the API lives on `api.example.com`, set
`API_BASE_URL=https://api.example.com`, `WEB_BASE_URL=https://example.com`
and `CORS_ORIGINS=https://example.com` accordingly.

> Next.js streams responses — disable `proxy_buffering` for the storefront
> location if you rely on progressive rendering.

### B. Split: managed frontend + containerized API

- **Storefront** on Vercel/Netlify/Cloudflare Workers (Next.js is supported
  out of the box). Set `API_BASE_URL` to the public API URL in the platform's
  environment settings.
- **API** anywhere that runs Node 20+ (Fly.io, Railway, Render, ECS, a
  container). Example Dockerfile:

```dockerfile
FROM node:22-alpine AS build
RUN npm i -g bun@1.3
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY packages/api-client/package.json packages/api-client/
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build:client && bun run --cwd apps/api build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/node_modules ./node_modules
COPY --from=build /app/apps/api/prisma ./prisma
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
```

### C. Desktop builds

Nothing to deploy — the desktop app bundles the same client and talks to the
API URL you configure (see [`mobile-integration.md`](mobile-integration.md)).

---

## 6. Payments in production

1. `PAYMENT_PROVIDER=zarinpal`
2. `ZARINPAL_MERCHANT_ID=<your merchant id>`
3. `ZARINPAL_CALLBACK_URL=https://api.example.com/api/v1/payments/zarinpal/callback`
   — register the exact URL with the gateway.
4. `API_BASE_URL` and `WEB_BASE_URL` must be the **public** HTTPS origins,
   otherwise the shopper is redirected to a `localhost` link after paying.

Keep `PAYMENT_PROVIDER=mock` only for development and demos: it signs its own
gateway and never moves money.

---

## 7. CI/CD sketch

```yaml
# .github/workflows/ci.yml (sketch — add your own secrets)
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env: { POSTGRES_PASSWORD: postgres }
        ports: ['5433:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun run lint
      - run: bun run test
      - run: bun run build
      - run: cp apps/api/.env.example apps/api/.env
      - run: bun run --cwd apps/api prisma:migrate
      - run: bun run test:e2e
```

Deploy step: build on CI, ship `dist/` + `.next/`, run `bun run db:deploy`,
restart processes (zero-downtime needs two app instances behind the proxy).

---

## 8. Operational checklist

- [ ] `.env` files are outside git and readable only by the service user
- [ ] `JWT_*_SECRET` are random per environment (not the example values)
- [ ] HTTPS everywhere; HSTS on the storefront origin
- [ ] `CORS_ORIGINS` lists only your own origins
- [ ] `pg_dump` backups running and **restored once** to prove them
- [ ] Health probe wired to monitoring: `GET /health` (returns `database: up|down`)
- [ ] Log rotation for the API and Next.js output
- [ ] Rate limiting / WAF at the proxy for `/api/v1/auth/*`
- [ ] Seed admin password changed (or the seed skipped) before launch
- [ ] `PAYMENT_PROVIDER=zarinpal` with a registered callback URL
- [ ] Smoke tests run against production after each deploy:
      `WEB_BASE=… API_BASE=… ./scripts/smoke-web.sh`

### Rollback

1. Re-deploy the previous build (keep at least one previous artifact).
2. Do **not** roll back the database automatically — add a forward fix
   migration instead.
3. Re-run both smoke suites.

---

## 9. Troubleshooting

| Symptom                                  | Likely cause                                                         |
| ---------------------------------------- | -------------------------------------------------------------------- |
| Store renders but every page 500s        | `API_BASE_URL` wrong, API not running — check `[web]` logs           |
| Redirected to `localhost` after paying   | `API_BASE_URL` / `WEB_BASE_URL` still dev values                     |
| `Invalid Host header` on the dev preview | Next dev host check — set the exact allowed host, don't disable it   |
| `P1017` / connection refused             | Migrations not deployed, or `DATABASE_URL` points at the dev port    |
| Cart empty after adding                  | Guest cart id lost — check that the client persists `x-cart-id`      |
| Persian search finds nothing             | `searchText` not populated — re-run the seed or a backfill migration |
| `403` from admin endpoints               | User role isn't `ADMIN`, or `Authorization` header missing           |
