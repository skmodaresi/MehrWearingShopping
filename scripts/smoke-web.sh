#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# MehrWearingShopping — storefront smoke test
#
# Verifies the Next.js BFF (not only the API): locale routing, RTL/LTR
# documents, public catalog rendering, and the authenticated pages driven by
# httpOnly session cookies (account, cart, checkout, admin).
#
# Usage:
#   ./scripts/smoke-web.sh
#   WEB_BASE=http://localhost:3000 API_BASE=http://localhost:4000 ./scripts/smoke-web.sh
#
# Prerequisites: API on :4000 (seeded), storefront on :3000. Exit 0 = all green.
# ---------------------------------------------------------------------------
set -euo pipefail

WEB_BASE="${WEB_BASE:-http://localhost:3000}"
API_BASE="${API_BASE:-http://localhost:4000}"
V1="$API_BASE/api/v1"
PASS=0
FAIL=0

json() { # json <dot.path> — reads JSON on stdin, prints the value
  node -e "
    let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
      try{const v=process.argv[1].split('.').reduce((o,k)=>o==null?o:o[k],JSON.parse(d));
          console.log(v===undefined||v===null?'':typeof v==='object'?JSON.stringify(v):v);}
      catch(e){console.log('');}
    })" "$1"
}

check() { # check <label> <actual> <expected>
  if [[ "$2" == "$3" ]]; then PASS=$((PASS+1)); printf '  ok   %s\n' "$1"
  else FAIL=$((FAIL+1)); printf '  FAIL %s (expected=%s actual=%s)\n' "$1" "$3" "$2"; fi
}

contains() { # contains <label> <haystack> <needle>
  if grep -qF -- "$3" <<<"$2"; then PASS=$((PASS+1)); printf '  ok   %s\n' "$1"
  else FAIL=$((FAIL+1)); printf '  FAIL %s (missing %s)\n' "$1" "$3"; fi
}

page() { curl -s -m 60 "$WEB_BASE$1" ${2:+-H "Cookie: $2"}; }

echo "== locale routing =="
code=$(curl -s -o /dev/null -w '%{http_code}' -m 30 "$WEB_BASE/")
redir=$(curl -s -o /dev/null -w '%{redirect_url}' -m 30 "$WEB_BASE/")
check "GET / answers" "$code" "307"
contains "GET / sends visitors to the Persian default" "$redir" "/fa-IR"

echo "== documents =="
fa=$(page /fa-IR)
en=$(page /en)
contains "fa-IR document is RTL" "$fa" '<html lang="fa-IR" dir="rtl"'
contains "en document is LTR" "$en" '<html lang="en" dir="ltr"'
check "no double locale prefix in fa" "$(grep -o '/fa-IR/fa-IR' <<<"$fa" | wc -l | tr -d ' ')" "0"
check "no double locale prefix in en" "$(grep -o '/en/en' <<<"$en" | wc -l | tr -d ' ')" "0"
contains "Persian hero copy renders" "$fa" 'استایل مردانه'
contains "English hero copy renders" "$en" 'Shop the collection'

echo "== public catalog =="
products=$(page /fa-IR/products)
contains "catalog lists products" "$products" 'class="product-media"'
contains "catalog shows the sort control" "$products" 'sort'

pdp=$(page /fa-IR/p/oxford-shirt)
contains "product detail renders buy box" "$pdp" 'افزودن به سبد خرید'
contains "product detail renders specs" "$pdp" 'مشخصات'

category=$(page /fa-IR/c/shirts)
check "category page answers" "$(curl -s -o /dev/null -w '%{http_code}' -m 30 "$WEB_BASE/fa-IR/c/shirts")" "200"

search=$(page '/fa-IR/search?q=shirt')
check "search page answers" "$(curl -s -o /dev/null -w '%{http_code}' -m 30 "$WEB_BASE/fa-IR/search?q=shirt")" "200"

notfound=$(curl -s -o /dev/null -w '%{http_code}' -m 30 "$WEB_BASE/fa-IR/definitely-not-a-page")
check "unknown route is 404" "$notfound" "404"

echo "== signed-out guards =="
signed_out=$(page /fa-IR/account)
contains "account redirects to login when signed out" \
  "$signed_out" '/fa-IR/login?next=%2Ffa-IR%2Faccount'

echo "== authenticated BFF (httpOnly cookies) =="
AUTH=$(curl -s -m 10 -X POST "$V1/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"demo@mehrwearing.ir","password":"Demo@12345"}')
ACCESS=$(json accessToken <<<"$AUTH")
REFRESH=$(json refreshToken <<<"$AUTH")
USER_JSON=$(json user <<<"$AUTH")
if [[ -z "$ACCESS" ]]; then
  printf '  FAIL could not log in as the seeded demo user\n'; FAIL=$((FAIL+1))
else
  USER_COOKIE=$(node -e 'console.log(encodeURIComponent(process.argv[1]))' "$USER_JSON")
  COOKIES="mws_access=$ACCESS; mws_refresh=$REFRESH; mws_user=$USER_COOKIE"

  # Seed a guest cart through the API so the storefront can read it back.
  CART_ID=$(node -e 'console.log(require("crypto").randomUUID())')
  VARIANT_ID=$(curl -s -m 10 "$V1/products?limit=1" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
    const p=JSON.parse(d).items[0]; console.log(p.variants?.[0]?.id ?? p.id);})")
  # The product card does not expose variant ids — ask the detail endpoint.
  SLUG=$(curl -s -m 10 "$V1/products?limit=1" | json items.0.slug)
  VARIANT_ID=$(curl -s -m 10 "$V1/products/$SLUG" | json variants.0.id)
  curl -s -m 10 -H "x-cart-id: $CART_ID" -H 'Content-Type: application/json' \
    -X POST "$V1/cart/items" -d "{\"variantId\":\"$VARIANT_ID\",\"qty\":1}" >/dev/null
  COOKIES="$COOKIES; mws_cart=$CART_ID"

  account=$(page /fa-IR/account "$COOKIES")
  contains "account page greets the signed-in user" "$account" 'سلام'
  contains "account page shows the profile form" "$account" 'اطلاعات حساب'

  addresses=$(page /fa-IR/account/addresses "$COOKIES")
  contains "address book renders" "$addresses" 'آدرس‌های من'

  orders=$(page /fa-IR/account/orders "$COOKIES")
  contains "order history renders" "$orders" 'سفارش‌های من'

  wishlist=$(page /fa-IR/wishlist "$COOKIES")
  contains "wishlist renders" "$wishlist" 'علاقه‌مندی‌ها'

  cart=$(page /fa-IR/cart "$COOKIES")
  contains "cart page renders the table or empty state" "$cart" 'سبد خرید'

  checkout=$(page /fa-IR/checkout "$COOKIES")
  contains "checkout renders the delivery form" "$checkout" 'آدرس تحویل'
fi

echo "== admin BFF =="
ADMIN_AUTH=$(curl -s -m 10 -X POST "$V1/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@mehrwearing.ir","password":"ChangeMe!Admin123"}')
ADMIN_ACCESS=$(json accessToken <<<"$ADMIN_AUTH")
ADMIN_USER=$(json user <<<"$ADMIN_AUTH")
if [[ -z "$ADMIN_ACCESS" ]]; then
  printf '  FAIL could not log in as the seeded admin\n'; FAIL=$((FAIL+1))
else
  ADMIN_COOKIE="mws_access=$ADMIN_ACCESS; mws_user=$(node -e 'console.log(encodeURIComponent(process.argv[1]))' "$ADMIN_USER")"
  admin=$(page /fa-IR/admin "$ADMIN_COOKIE")
  contains "admin dashboard renders KPIs" "$admin" 'پنل مدیریت'
  adminProducts=$(page /fa-IR/admin/products "$ADMIN_COOKIE")
  contains "product management table renders" "$adminProducts" 'موجودی'
fi

echo
printf '%s/%s checks passed\n' "$PASS" "$((PASS + FAIL))"
if [[ "$FAIL" -gt 0 ]]; then exit 1; fi
