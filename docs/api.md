# API reference

Base URL: `http://localhost:4000/api/v1` (dev) — production base is whatever
you set in `API_BASE_URL`.

The authoritative, machine-readable contract is [`openapi.json`](openapi.json)
(regenerate with `bun run openapi`). An interactive Swagger UI is served at
**`/api/docs`**, and a health probe at **`GET /health`**.

---

## Conventions

### Headers

| Header          | Required                                                                                                          | Purpose                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `Authorization` | Bearer access token on every `/auth/me`, `/users/*`, `/cart`, `/orders`, `/wishlist`, `/reviews`, `/admin/*` call |
| `x-cart-id`     | no                                                                                                                | Identifies a guest cart. The API **issues** it (`x-cart-id` |

                  response header or `cartId` in the body) — persist it and echo it back |

| `x-locale` | no | `fa-IR` \| `en`. Recorded on orders so you know which language
the shopper used. Falls back to the account locale, then `fa-IR` |
| `Content-Type` | `application/json` on writes | |

### Pagination

List endpoints return the same envelope:

```json
{ "items": [ … ], "total": 137, "page": 2, "pages": 7, "limit": 24 }
```

`page` is 1-based; `limit` is clamped to 100.

### Errors

```json
{
  "code": "OUT_OF_STOCK",
  "message": "Not enough stock for SKU TS-M-BLK",
  "details": { "sku": "TS-M-BLK" }
}
```

`code` is stable and machine-readable — translate it in your client, never
parse `message`. Common codes:

| Code                                                                            | Meaning                                             |
| ------------------------------------------------------------------------------- | --------------------------------------------------- |
| `INVALID_CREDENTIALS`                                                           | Wrong email/password (uniform message)              |
| `EMAIL_TAKEN`                                                                   | Registration with an existing email                 |
| `UNAUTHORIZED` / `INVALID_TOKEN`                                                | Missing or expired bearer token                     |
| `FORBIDDEN`                                                                     | Signed in, but not allowed (e.g. non-admin)         |
| `OUT_OF_STOCK`                                                                  | Quantity exceeds available stock                    |
| `CART_EMPTY`                                                                    | Checkout with an empty cart                         |
| `ADDRESS_NOT_FOUND`                                                             | Order references an address you don't own           |
| `COUPON_NOT_FOUND` / `COUPON_EXPIRED` / `COUPON_EXHAUSTED` / `COUPON_MIN_ORDER` | Coupon rejected                                     |
| `ALREADY_PAID` / `ORDER_NOT_PAYABLE` / `ORDER_NOT_CANCELLABLE`                  | Illegal order transition                            |
| `NOT_PURCHASED` / `REVIEW_EXISTS`                                               | Review rules                                        |
| `PAYMENT_NOT_CONFIGURED` / `GATEWAY_ERROR`                                      | Payment provider problems                           |
| `VALIDATION_ERROR`                                                              | Body/query failed validation (`details` has fields) |

---

## Endpoints

### Health

| Method | Path      | Auth | Notes                       |
| ------ | --------- | ---- | --------------------------- |
| GET    | `/health` | —    | status, version, DB up/down |

### Auth

| Method | Path             | Auth   | Notes                                                           |
| ------ | ---------------- | ------ | --------------------------------------------------------------- |
| POST   | `/auth/register` | —      | `{ email, password, fullName, phone?, locale }` → tokens + user |
| POST   | `/auth/login`    | —      | `{ email, password }` → tokens + user                           |
| POST   | `/auth/refresh`  | —      | `{ refreshToken }` → **new** pair (rotated)                     |
| POST   | `/auth/logout`   | —      | `{ refreshToken }` → revokes it                                 |
| GET    | `/auth/me`       | Bearer | Current user                                                    |

### Profile & addresses

| Method | Path                       | Auth                                |
| ------ | -------------------------- | ----------------------------------- |
| PATCH  | `/users/me`                | Bearer                              |
| POST   | `/users/me/password`       | Bearer (revokes all refresh tokens) |
| GET    | `/users/me/addresses`      | Bearer                              |
| POST   | `/users/me/addresses`      | Bearer                              |
| DELETE | `/users/me/addresses/{id}` | Bearer                              |

### Catalog (public)

| Method | Path                       | Notes                                                             |
| ------ | -------------------------- | ----------------------------------------------------------------- |
| GET    | `/categories`              | Active categories with product counts                             |
| GET    | `/categories/{slug}`       | Single category incl. children                                    |
| GET    | `/brands`                  | Brands with counts                                                |
| GET    | `/products`                | **The workhorse** — see query params below                        |
| GET    | `/products/featured`       | Home page row (8)                                                 |
| GET    | `/products/deals`          | Discounted row (8)                                                |
| GET    | `/products/facets`         | Sizes, colors, brands, price range for the current filter context |
| GET    | `/products/{slug}`         | Full bilingual detail with variants + specs                       |
| GET    | `/products/{slug}/related` | Same category, minus itself                                       |
| GET    | `/products/{slug}/reviews` | Approved reviews (paginated)                                      |

`GET /products` query parameters:

```
category   slug            brand      slug
q          full-text search (Persian- and English-normalized)
minPrice   maxPrice        integer Toman
sizes      M,L             colors     مشکی,Silver   (comma separated)
inStock    1|0             discount   1|0
featured   1|0             sort       newest | price-asc | price-desc | rating | bestseller
page       default 1       limit      default 20, max 100
```

```bash
curl 'http://localhost:4000/api/v1/products?category=shirts&sizes=M,L&sort=price-asc&limit=5'
```

### Cart (guest or signed in)

| Method | Path                      | Notes                                 |
| ------ | ------------------------- | ------------------------------------- |
| GET    | `/cart`                   | Creates + returns a guest cart if new |
| POST   | `/cart/items`             | `{ variantId, qty }`                  |
| PATCH  | `/cart/items/{variantId}` | `{ qty }` (0 removes)                 |
| DELETE | `/cart/items/{variantId}` |                                       |

### Coupons

| Method | Path                | Auth | Notes                                                      |
| ------ | ------------------- | ---- | ---------------------------------------------------------- |
| POST   | `/coupons/validate` | —    | `{ code, subtotalToman }` → discount preview or error code |

### Orders & payments

| Method | Path                           | Auth   | Notes                                                                           |
| ------ | ------------------------------ | ------ | ------------------------------------------------------------------------------- |
| POST   | `/orders`                      | Bearer | `{ addressId, shippingMethod, couponCode?, note? }` — reserves stock atomically |
| GET    | `/orders`                      | Bearer | My orders (paginated)                                                           |
| GET    | `/orders/{orderNumber}`        | Bearer | Detail + tracking timeline                                                      |
| POST   | `/orders/{orderNumber}/cancel` | Bearer | Unpaid orders only; restores stock                                              |
| POST   | `/orders/{orderNumber}/pay`    | Bearer | → `{ gatewayUrl, authority, amountToman }`                                      |
| GET    | `/payments/mock/checkout`      | —      | Dev gateway page                                                                |
| GET    | `/payments/mock/callback`      | —      | Dev gateway return → 302 to the store                                           |
| GET    | `/payments/zarinpal/callback`  | —      | Zarinpal return → 302 to the store                                              |

Return URL shape:
`{WEB_BASE_URL}/{locale}/order/{orderNumber}?payment=success|failed|cancelled`

### Reviews & wishlist

| Method | Path                    | Auth   | Notes                                   |
| ------ | ----------------------- | ------ | --------------------------------------- |
| POST   | `/reviews`              | Bearer | Verified purchase required, moderated   |
| PATCH  | `/reviews/{id}`         | Bearer | Edit own review (returns to moderation) |
| GET    | `/wishlist`             | Bearer | → **array** of product cards            |
| POST   | `/wishlist/{productId}` | Bearer | `{ success, added }`                    |
| DELETE | `/wishlist/{productId}` | Bearer | `{ success, removed }`                  |

### Admin (`role=ADMIN`)

| Method         | Path                                                                             |
| -------------- | -------------------------------------------------------------------------------- |
| GET            | `/admin/stats`                                                                   |
| GET            | `/admin/orders?status=&page=&limit=`                                             |
| GET            | `/admin/orders/{id}`                                                             |
| POST           | `/admin/orders/{id}/status` · `/admin/orders/{id}/cancel`                        |
| GET            | `/admin/products?q=&page=&limit=` (any status, with per-variant stock)           |
| POST           | `/admin/products` · PATCH `/admin/products/{id}`                                 |
| POST           | `/admin/products/{id}/variants`                                                  |
| PATCH          | `/admin/products/{id}/variants/{variantId}` (absolute stock, records a movement) |
| GET/PATCH      | `/admin/categories[/{id}]` · `/admin/brands[/{id}]`                              |
| GET            | `/admin/reviews?status=PENDING`                                                  |
| PATCH          | `/admin/reviews/{id}/status`                                                     |
| GET/POST/PATCH | `/admin/coupons[/{id}]`                                                          |

---

## End-to-end example

```bash
API=http://localhost:4000/api/v1

# 1. sign in
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"demo@mehrwearing.ir","password":"Demo@12345"}' | jq -r .accessToken)
AUTH="Authorization: Bearer $TOKEN"

# 2. browse + cart (guest id is issued on the first GET /cart)
CART=$(curl -s -D - -o /dev/null $API/cart | grep -i '^x-cart-id:' | tr -d '\r' | cut -d' ' -f2)
CID="x-cart-id: $CART"
SLUG=$(curl -s "$API/products?limit=1" | jq -r .items[0].slug)
VID=$(curl -s "$API/products/$SLUG" | jq -r .variants[0].id)
curl -s -X POST $API/cart/items -H "$AUTH" -H "$CID" \
  -H 'Content-Type: application/json' -d "{\"variantId\":\"$VID\",\"qty\":1}"

# 3. address → order → pay
ADDR=$(curl -s $API/users/me/addresses -H "$AUTH" | jq -r '.[0].id')
ORDER=$(curl -s -X POST $API/orders -H "$AUTH" -H "$CID" -H 'Content-Type: application/json' \
  -d "{\"addressId\":\"$ADDR\",\"shippingMethod\":\"STANDARD\"}")
curl -s -X POST "$API/orders/$(echo $ORDER | jq -r .orderNumber)/pay" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{}'
```

`scripts/smoke-api.sh` runs exactly this journey (plus coupons, moderation and
admin transitions) and exits non-zero on the first broken step.
