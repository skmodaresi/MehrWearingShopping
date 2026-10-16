/**
 * Wire types for the MehrWearingShopping API.
 *
 * These mirror the REST responses produced by apps/api (see docs/openapi.json
 * for the authoritative contract). Keeping them in a shared package means the
 * web storefront, the mobile app and any desktop client all agree on shapes.
 */

// --- auth -----------------------------------------------------------------

export type Role = 'ADMIN' | 'CUSTOMER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  locale: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// --- catalog --------------------------------------------------------------

export interface Category {
  id: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  imageUrl: string | null;
  parentId: string | null;
  position: number;
  isActive: boolean;
  productCount?: number;
  children?: Category[];
}

export interface Brand {
  id: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  country: string | null;
  productCount?: number;
}

export interface ProductCard {
  id: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  priceToman: number;
  compareAtPriceToman: number | null;
  discountPercent: number;
  image: string | null;
  ratingAverage: number;
  ratingCount: number;
  salesCount: number;
  isFeatured: boolean;
  inStock: boolean;
  stockTotal: number;
  sizes: string[];
  category: { slug: string; nameFa: string; nameEn: string };
  brand: { slug: string; nameFa: string; nameEn: string } | null;
}

export interface ProductVariant {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  colorEn: string | null;
  colorHex: string | null;
  priceToman: number | null;
  effectivePriceToman: number;
  stock: number;
  inStock: boolean;
}

export interface ProductDetail extends ProductCard {
  descriptionFa: string;
  descriptionEn: string;
  weightGram: number | null;
  status: string;
  createdAt: string;
  images: Array<{ url: string; altFa: string | null; altEn: string | null }>;
  variants: ProductVariant[];
  specs: Array<{ keyFa: string; keyEn: string; valueFa: string; valueEn: string }>;
}

export type ProductSort = 'newest' | 'price-asc' | 'price-desc' | 'rating' | 'bestseller';

export interface ProductListQuery {
  category?: string;
  brand?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  sizes?: string[] | string;
  colors?: string[] | string;
  inStock?: boolean;
  discount?: boolean;
  featured?: boolean;
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface Facets {
  sizes: string[];
  colors: Array<{ color: string; colorEn: string | null; colorHex: string | null }>;
  priceRange: { min: number; max: number };
  brands: Array<{ slug: string; nameFa: string; nameEn: string }>;
  total: number;
}

// --- cart -----------------------------------------------------------------

export interface CartItem {
  variantId: string;
  sku: string;
  size: string | null;
  color: string | null;
  colorEn: string | null;
  colorHex: string | null;
  qty: number;
  unitPriceToman: number;
  lineTotalToman: number;
  stock: number;
  available: boolean;
  product: { id: string; slug: string; nameFa: string; nameEn: string; image: string | null };
}

export interface Cart {
  cartId: string;
  items: CartItem[];
  itemCount: number;
  subtotalToman: number;
}

// --- coupons --------------------------------------------------------------

export interface CouponPreview {
  code: string;
  type: 'PERCENT' | 'FIXED' | 'SHIPPING';
  value: number;
  discountToman: number;
  freeShipping: boolean;
  descriptionFa: string;
  descriptionEn: string;
}

// --- orders ---------------------------------------------------------------

export type OrderStatus =
  'PENDING' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';

export type PaymentStatus = 'NOT_PAID' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface OrderItem {
  id: string;
  variantId: string | null;
  productId: string;
  productNameFa: string;
  productNameEn: string;
  variantLabel: string | null;
  imageUrl: string | null;
  sku: string;
  unitPriceToman: number;
  qty: number;
  lineTotalToman: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  locale: string;
  subtotalToman: number;
  discountToman: number;
  shippingCostToman: number;
  totalToman: number;
  couponCode: string | null;
  shippingMethod: 'STANDARD' | 'EXPRESS';
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  addressLine: string;
  note: string | null;
  placedAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  items: OrderItem[];
  timeline: Array<{ status: OrderStatus; at: string }>;
  customer?: { id: string; email: string; fullName: string };
}

export interface StartPayment {
  orderNumber: string;
  provider: 'MOCK' | 'ZARINPAL';
  gatewayUrl: string;
  authority: string | null;
  amountToman: number;
}

// --- reviews / wishlist / users -------------------------------------------

export interface Review {
  id: string;
  productId: string;
  productSlug?: string;
  rating: number;
  title: string | null;
  body: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  customerName: string;
  createdAt: string;
}

export interface Address {
  id: string;
  label: string | null;
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  addressLine: string;
  isDefault: boolean;
  createdAt: string;
}

export interface AddressInput {
  label?: string;
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  addressLine: string;
  isDefault?: boolean;
}

// --- admin ----------------------------------------------------------------

export interface AdminStats {
  revenue: { todayToman: number; monthToman: number; allTimeToman: number; paidOrders: number };
  orders: { total: number; byStatus: Record<string, number> };
  customers: number;
  products: number;
  lowStock: Array<{
    sku: string;
    stock: number;
    size: string | null;
    color: string | null;
    product: { slug: string; nameFa: string; nameEn: string };
  }>;
  topProducts: Array<{
    slug: string;
    nameFa: string;
    nameEn: string;
    salesCount: number;
    priceToman: number;
    image: string | null;
  }>;
  recentOrders: Array<{
    orderNumber: string;
    status: OrderStatus;
    totalToman: number;
    placedAt: string;
    customer: string;
  }>;
}

export interface PlaceOrderInput {
  addressId: string;
  shippingMethod: 'STANDARD' | 'EXPRESS';
  couponCode?: string;
  note?: string;
}

/**
 * Management row for a product (`GET /admin/products`): unlike the public
 * card it exposes status, featured flag and per-variant stock.
 */
export interface AdminProductRow {
  id: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  priceToman: number;
  compareAtPriceToman: number | null;
  isFeatured: boolean;
  status: string;
  stockTotal: number;
  category: { slug: string; nameFa: string; nameEn: string };
  brand: { slug: string; nameFa: string; nameEn: string } | null;
  variants: Array<{
    id: string;
    sku: string;
    size: string | null;
    color: string | null;
    stock: number;
  }>;
}
