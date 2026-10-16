import type { ProductCard as ProductCardData } from '@mehrwearing/api-client';
import { ProductCard } from './product-card';

/**
 * Responsive product grid shared by home, category, brand, search and
 * wishlist views. Plain component (no hooks) so both server and client
 * trees can render it.
 */
export function ProductGrid({
  products,
  locale,
  empty,
}: {
  products: ProductCardData[];
  locale: string;
  empty?: string;
}) {
  if (products.length === 0 && empty) {
    return (
      <div className="card flex flex-col items-center gap-3 p-12 text-center">
        <span className="text-4xl">🧺</span>
        <p className="font-bold text-slate-700">{empty}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} locale={locale} />
      ))}
    </div>
  );
}
