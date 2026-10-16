import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import type { Category, ProductCard } from '@mehrwearing/api-client';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useCart } from '@/lib/state';
import { ProductImage } from '@/components/product-image';

/**
 * Catalog screen: search, category filter and the product grid — the same
 * `GET /products` the storefront uses, so both apps always agree on stock,
 * price and localization.
 */
export default function CatalogScreen() {
  const { t, formatPrice, pick } = useI18n();
  const router = useRouter();
  const { cart } = useCart();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const chips = useMemo(
    () => [
      { slug: '', nameFa: 'همه', nameEn: 'All' },
      ...categories.map((entry) => ({
        slug: entry.slug,
        nameFa: entry.nameFa,
        nameEn: entry.nameEn,
      })),
    ],
    [categories],
  );

  useEffect(() => {
    void api.catalog
      .categories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await api.catalog.products({
        q: query.trim() || undefined,
        category,
        sort: 'bestseller',
        limit: 24,
      });
      setProducts(page.items);
    } catch {
      setError('common.error');
    } finally {
      setLoading(false);
    }
  }, [query, category]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('nav.search')}
          style={styles.search}
          returnKeyType="search"
        />
        <Link href="/cart" asChild>
          <Pressable style={styles.cartButton} accessibilityLabel={t('nav.cart')}>
            <Text style={styles.cartIcon}>🛒</Text>
            {cart && cart.itemCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cart.itemCount}</Text>
              </View>
            )}
          </Pressable>
        </Link>
      </View>

      <FlatList
        horizontal
        data={chips}
        keyExtractor={(item) => item.slug || 'all'}
        showsHorizontalScrollIndicator={false}
        style={styles.chips}
        contentContainerStyle={styles.chipsContent}
        renderItem={({ item }) => {
          const active = (category ?? '') === item.slug;
          return (
            <Pressable
              onPress={() => setCategory(item.slug || undefined)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {pick(item.nameEn, item.nameFa)}
              </Text>
            </Pressable>
          );
        }}
      />

      {loading ? (
        <ActivityIndicator style={styles.center} />
      ) : error ? (
        <Pressable onPress={() => void load()} style={styles.center}>
          <Text style={styles.errorText}>{t('common.error')}</Text>
          <Text style={styles.retry}>{t('common.retry')}</Text>
        </Pressable>
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          ListEmptyComponent={<Text style={styles.empty}>{t('cart.empty')}</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/product/${item.slug}`)}>
              <ProductImage uri={item.image} style={styles.cardImage} />
              <Text numberOfLines={2} style={styles.cardTitle}>
                {pick(item.nameFa, item.nameEn)}
              </Text>
              <Text style={styles.cardPrice}>{formatPrice(item.priceToman)}</Text>
              {item.discountPercent > 0 && (
                <Text style={styles.cardDiscount}>−{item.discountPercent}%</Text>
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  topBar: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'center' },
  search: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  cartButton: { padding: 8 },
  cartIcon: { fontSize: 20 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ea580c',
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  chips: { maxHeight: 44, flexGrow: 0 },
  chipsContent: { gap: 8, paddingHorizontal: 12 },
  chip: {
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#fff' },
  center: { paddingVertical: 64, alignItems: 'center', gap: 8 },
  errorText: { color: '#dc2626', fontWeight: '600' },
  retry: { color: '#ea580c', fontWeight: '700' },
  grid: { padding: 12, gap: 12 },
  row: { gap: 12 },
  empty: { textAlign: 'center', paddingVertical: 48, color: '#64748b' },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    gap: 4,
  },
  cardImage: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#f1f5f9' },
  cardTitle: { fontWeight: '700', color: '#0f172a', fontSize: 14, lineHeight: 20 },
  cardPrice: { fontWeight: '800', color: '#0f172a', fontSize: 14 },
  cardDiscount: { color: '#dc2626', fontWeight: '700', fontSize: 12 },
});
