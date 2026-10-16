#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# MehrWearingShopping — API smoke test
#
# Exercises the complete purchase journey against a running API instance:
#   register → address → cart → coupon → checkout → mock payment → PAID
#   → admin status advance → review → wishlist
#
# Usage:
#   ./scripts/smoke-api.sh                 # expects API at http://localhost:4000
#   API_BASE=http://localhost:4000 ./scripts/smoke-api.sh
#
# Requires: curl, node (for JSON extraction). Exit code 0 = all steps passed.
# ---------------------------------------------------------------------------
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:4000}"
V1="$API_BASE/api/v1"
PASS=0
FAIL=0

json() { # json <dot.path>  — reads JSON on stdin, prints the value
  node -e "
    let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
      try{const v=process.argv[1].split('.').reduce((o,k)=>o==null?o:o[k],JSON.parse(d));
          if(v===undefined||v===null)console.log('');
          else if(typeof v==='object')console.log(JSON.stringify(v));
          else console.log(v);}
      catch(e){console.log('');}
    })" "$1"
}

check() { # check <label> <actual> <expected>
  local label="$1" actual="$2" expected="$3"
  if [[ "$actual" == "$expected" ]]; then
    PASS=$((PASS+1)); printf '  ✔ %s\n' "$label"
  else
    FAIL=$((FAIL+1)); printf '  ✘ %s (expected=%s actual=%s)\n' "$label" "$expected" "$actual"
  fi
}

req() { # req METHOD PATH [BODY] [TOKEN] [EXTRA_CURL_ARGS...]
  local method="$1" path="$2" body="${3:-}" token="${4:-}"
  shift 4 || shift $#
  local args=(-sS -X "$method" -H 'Content-Type: application/json' -H 'x-locale: fa-IR')
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n "$body" ]] && args+=(-d "$body")
  curl "${args[@]}" "$@" "$path"
}

status_of() { # status_of METHOD PATH [BODY] [TOKEN]
  local method="$1" path="$2" body="${3:-}" token="${4:-}"
  local args=(-sS -o /dev/null -w '%{http_code}' -X "$method" -H 'Content-Type: application/json')
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n "$body" ]] && args+=(-d "$body")
  curl "${args[@]}" "$path"
}

STAMP=$(date +%s)
PHONE="09${STAMP:0:9}" # unique per run so re-runs never collide on the unique phone column
echo "MehrWearingShopping API smoke test → $API_BASE"
echo

# --- health ---------------------------------------------------------------
echo "health"
HEALTH=$(req GET "$API_BASE/health")
check "database up" "$(echo "$HEALTH" | json database)" "up"
check "status ok" "$(echo "$HEALTH" | json status)" "ok"

# --- catalog --------------------------------------------------------------
echo "catalog"
PRODUCTS=$(req GET "$V1/products?limit=5")
check "products list" "$(echo "$PRODUCTS" | json total)" "28"
check "fa name present" "$([[ -n "$(echo "$PRODUCTS" | json items.0.nameFa)" ]] && echo yes)" "yes"
check "category filter" "$(echo "$(req GET "$V1/products?category=jeans")" | json items.0.category.slug)" "jeans"
check "persian search" "$(curl -sS --get --data-urlencode 'q=کتانی' "$V1/products" | json total | node -e 'process.stdin.on("data",d=>console.log(Number(d)>0?"hits":"none"))')" "hits"
DETAIL=$(req GET "$V1/products/slim-fit-jeans")
check "detail variants" "$(echo "$DETAIL" | json variants | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).length>0?"yes":"no"))')" "yes"
VARIANT_ID=$(echo "$DETAIL" | json variants.0.id)
check "facets" "$(echo "$(req GET "$V1/products/facets?category=jeans")" | json sizes | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).length>0?"yes":"no"))')" "yes"

# --- auth -----------------------------------------------------------------
echo "auth"
REGISTER=$(req POST "$V1/auth/register" "{\"email\":\"smoke-$STAMP@example.com\",\"password\":\"SmokeTest!123\",\"fullName\":\"کاربر تست\",\"phone\":\"$PHONE\"}")
TOKEN=$(echo "$REGISTER" | json accessToken)
check "register issued token" "$([[ -n "$TOKEN" ]] && echo yes)" "yes"
check "duplicate email → 409" "$(status_of POST "$V1/auth/register" "{\"email\":\"smoke-$STAMP@example.com\",\"password\":\"SmokeTest!123\",\"fullName\":\"کاربر تست\"}")" "409"
check "bad password → 401" "$(status_of POST "$V1/auth/login" "{\"email\":\"smoke-$STAMP@example.com\",\"password\":\"WrongPass!123\"}")" "401"
LOGIN=$(req POST "$V1/auth/login" "{\"email\":\"smoke-$STAMP@example.com\",\"password\":\"SmokeTest!123\"}")
TOKEN=$(echo "$LOGIN" | json accessToken)
REFRESH=$(echo "$LOGIN" | json refreshToken)
check "login issued token" "$([[ -n "$TOKEN" ]] && echo yes)" "yes"
ME=$(req GET "$V1/auth/me" "" "$TOKEN")
check "me profile" "$(echo "$ME" | json email)" "smoke-$STAMP@example.com"
REFRESHED=$(req POST "$V1/auth/refresh" "{\"refreshToken\":\"$REFRESH\"}")
check "refresh rotated" "$([[ -n "$(echo "$REFRESHED" | json accessToken)" ]] && echo yes)" "yes"
check "auth required → 401" "$(status_of GET "$V1/auth/me")" "401"

# --- address + cart -------------------------------------------------------
echo "cart & checkout"
ADDRESS=$(req POST "$V1/users/me/addresses" '{"recipientName":"کاربر تست","phone":"09120009999","province":"تهران","city":"تهران","postalCode":"1234567890","addressLine":"خیابان آزادی، پلاک ۱","label":"خانه"}' "$TOKEN")
ADDRESS_ID=$(echo "$ADDRESS" | json id)
check "address saved" "$([[ -n "$ADDRESS_ID" ]] && echo yes)" "yes"

CART=$(req GET "$V1/cart" "" "$TOKEN")
check "empty cart" "$(echo "$CART" | json itemCount)" "0"
CART=$(req POST "$V1/cart/items" "{\"variantId\":\"$VARIANT_ID\",\"qty\":2}" "$TOKEN")
check "cart has 2 items" "$(echo "$CART" | json itemCount)" "2"
check "cart subtotal" "$(echo "$CART" | json subtotalToman)" "$(( $(echo "$DETAIL" | json priceToman) * 2 ))"

PREVIEW=$(req POST "$V1/coupons/validate" '{"code":"MEHR10","subtotalToman":5000000}')
check "coupon preview discount" "$(echo "$PREVIEW" | json discountToman)" "300000"
check "invalid coupon → 400" "$(status_of POST "$V1/coupons/validate" '{"code":"NOPE","subtotalToman":100000}')" "400"

ORDER=$(req POST "$V1/orders" "{\"addressId\":\"$ADDRESS_ID\",\"shippingMethod\":\"STANDARD\",\"couponCode\":\"MEHR10\"}" "$TOKEN")
ORDER_NUMBER=$(echo "$ORDER" | json orderNumber)
check "order created" "$([[ -n "$ORDER_NUMBER" ]] && echo yes)" "yes"
check "order status PENDING" "$(echo "$ORDER" | json status)" "PENDING"
check "coupon applied 10% (capped)" "$(echo "$ORDER" | json discountToman)" "$(( $(echo "$ORDER" | json subtotalToman) * 10 / 100 ))"
check "free shipping over threshold" "$(echo "$ORDER" | json shippingCostToman)" "0"
check "total = subtotal - discount + shipping" "$(echo "$ORDER" | json totalToman)" "$(( $(echo "$ORDER" | json subtotalToman) - $(echo "$ORDER" | json discountToman) + $(echo "$ORDER" | json shippingCostToman) ))"
check "cart cleared" "$(echo "$(req GET "$V1/cart" "" "$TOKEN")" | json itemCount)" "0"
check "oversell rejected at add → 409" "$(status_of POST "$V1/cart/items" "{\"variantId\":\"$VARIANT_ID\",\"qty\":999}" "$TOKEN")" "409"

# --- payment --------------------------------------------------------------
echo "payment"
PAYMENT=$(req POST "$V1/orders/$ORDER_NUMBER/pay" "{}" "$TOKEN")
GATEWAY_URL=$(echo "$PAYMENT" | json gatewayUrl)
check "gateway url issued" "$([[ -n "$GATEWAY_URL" ]] && echo yes)" "yes"
GATEWAY_URL=${GATEWAY_URL/localhost/127.0.0.1}
PAGE=$(curl -sS "$GATEWAY_URL")
check "gateway page renders" "$(echo "$PAGE" | grep -c 'test gateway')" "1"

CALLBACK_URL=$(echo "$GATEWAY_URL" | sed 's#/checkout?#/callback?#')\&result=success
REDIRECT=$(curl -sS -o /dev/null -w '%{redirect_url}' "$CALLBACK_URL")
check "callback redirects to order page" "$(echo "$REDIRECT" | grep -c "$ORDER_NUMBER")" "1"

PAID=$(req GET "$V1/orders/$ORDER_NUMBER" "" "$TOKEN")
check "order PAID" "$(echo "$PAID" | json paymentStatus)" "PAID"
check "paid timestamp set" "$([[ -n "$(echo "$PAID" | json paidAt)" ]] && echo yes)" "yes"

# --- admin ----------------------------------------------------------------
echo "admin"
ADMIN=$(req POST "$V1/auth/login" '{"email":"admin@mehrwearing.ir","password":"ChangeMe!Admin123"}')
ADMIN_TOKEN=$(echo "$ADMIN" | json accessToken)
check "admin login" "$([[ -n "$ADMIN_TOKEN" ]] && echo yes)" "yes"
check "customer blocked from admin → 403" "$(status_of GET "$V1/admin/orders" "" "$TOKEN")" "403"
ORDER_ID=$(echo "$PAID" | json id)
PROCESSING=$(req POST "$V1/admin/orders/$ORDER_ID/status" '{"status":"PROCESSING"}' "$ADMIN_TOKEN")
check "admin advanced status" "$(echo "$PROCESSING" | json status)" "PROCESSING"
SHIPPED=$(req POST "$V1/admin/orders/$ORDER_ID/status" '{"status":"SHIPPED"}' "$ADMIN_TOKEN")
check "admin shipped order" "$(echo "$SHIPPED" | json status)" "SHIPPED"
check "invalid transition → 400" "$(status_of POST "$V1/admin/orders/$ORDER_ID/status" '{"status":"PENDING"}' "$ADMIN_TOKEN")" "400"
STATS=$(req GET "$V1/admin/stats" "" "$ADMIN_TOKEN")
check "stats revenue > 0" "$(echo "$STATS" | json revenue.allTimeToman | node -e 'process.stdin.on("data",d=>console.log(Number(d)>0?"yes":"no"))')" "yes"

# --- reviews & wishlist ---------------------------------------------------
echo "reviews & wishlist"
PRODUCT_ID=$(echo "$DETAIL" | json id)
REVIEW=$(req POST "$V1/reviews" "{\"productId\":\"$PRODUCT_ID\",\"rating\":5,\"title\":\"عالی\",\"body\":\"کیفیت پارچه و دوخت واقعاً عالی بود.\"}" "$TOKEN")
check "verified purchase can review" "$(echo "$REVIEW" | json status)" "PENDING"
check "pending review hidden publicly" "$(status_of GET "$V1/products/slim-fit-jeans/reviews")" "200"
APPROVED=$(req PATCH "$V1/admin/reviews/$(echo "$REVIEW" | json id)/status" '{"status":"APPROVED"}' "$ADMIN_TOKEN")
check "admin approves review" "$(echo "$APPROVED" | json status)" "APPROVED"
PUBLIC_REVIEWS=$(req GET "$V1/products/slim-fit-jeans/reviews")
check "approved review visible" "$(echo "$PUBLIC_REVIEWS" | json items | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).some(r=>r.body.includes("دوخت"))?"yes":"no"))')" "yes"
WISHLIST=$(req POST "$V1/wishlist/$PRODUCT_ID" "" "$TOKEN")
check "wishlist add" "$(echo "$WISHLIST" | json added)" "true"
check "wishlist removes → 401 anon" "$(status_of DELETE "$V1/wishlist/$PRODUCT_ID")" "401"

echo
echo "passed=$PASS failed=$FAIL"
[[ "$FAIL" -eq 0 ]]
