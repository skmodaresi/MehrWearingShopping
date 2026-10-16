import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ProductCard, ProductDetail, ProductVariant } from '@mehrwearing/api-client';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useCart } from '@/lib/state';
import { ProductImage } from '@/components/product-image';

/** Product detail: gallery, variant picker, add-to-cart and related items. */
export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, formatPrice, pick } = useI18n();
  const { add, refresh } = useCart();
  const router = useRouter();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [related, setRelated] = useState<ProductCard[]>([]);
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!slug) return;
    void Promise.all([
      api.catalog.product(slug).catch(() => null),
      api.catalog.related(slug).catch(() => [] as ProductCard[]),
    ]).then(([detail, items]) => {
      setProduct(detail);
      setRelated(items);
      if (detail) {
        const firstColor = detail.variants.find((variant) => variant.color)?.color ?? null;
        setColor(firstColor);
      }
    });
  }, [slug]);

  const variants: ProductVariant[] = product?.variants ?? [];
  const colors = Array.from(
    new Set(variants.map((variant) => variant.color).filter(Boolean)),
  ) as string[];
  const sizesForColor = variants.filter((variant) => (color ? variant.color === color : true));
  const selected =
    variants.find((variant) => variant.size === size && variant.color === color) ??
    sizesForColor[0] ??
    null;

  const addToCart = useCallback(async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const code = await add(selected.id, 1);
    setBusy(false);
    if (code) {
      setError(code);
      return;
    }
    setAdded(true);
    await refresh();
    setTimeout(() => setAdded(false), 2000);
  }, [add, refresh, selected]);

  if (!product) {
    return <ActivityIndicator style={styles.center} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ProductImage uri={product.image} style={styles.hero} />

      <Text style={styles.title}>{pick(product.nameFa, product.nameEn)}</Text>
      <Text style={styles.category}>{pick(product.category.nameFa, product.category.nameEn)}</Text>

      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatPrice(product.priceToman)}</Text>
        {product.compareAtPriceToman && product.compareAtPriceToman > product.priceToman && (
          <Text style={styles.oldPrice}>{formatPrice(product.compareAtPriceToman)}</Text>
        )}
        <Text style={[styles.stock, !product.inStock && styles.outOfStock]}>
          {product.inStock ? t('product.inStock') : t('product.outOfStock')}
        </Text>
      </View>

      {colors.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.label}>{t('product.size')}</Text>
          <View style={styles.options}>
            {colors.map((entry) => (
              <Pressable
                key={entry}
                onPress={() => {
                  setColor(entry);
                  setSize(null);
                }}
                style={[styles.option, color === entry && styles.optionActive]}
              >
                <Text style={[styles.optionText, color === entry && styles.optionTextActive]}>
                  {entry}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {sizesForColor.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.label}>{t('product.size')}</Text>
          <View style={styles.options}>
            {sizesForColor.map((variant) => (
              <Pressable
                key={variant.id}
                disabled={!variant.inStock}
                onPress={() => setSize(variant.size)}
                style={[
                  styles.option,
                  size === variant.size && styles.optionActive,
                  !variant.inStock && styles.optionDisabled,
                ]}
              >
                <Text style={[styles.optionText, size === variant.size && styles.optionTextActive]}>
                  {variant.size}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Pressable
        onPress={addToCart}
        disabled={!selected?.inStock || busy}
        style={[styles.addButton, (!selected?.inStock || busy) && styles.addButtonDisabled]}
      >
        <Text style={styles.addButtonText}>
          {added ? t('product.added') : t('product.addToCart')}
        </Text>
      </Pressable>

      {error && <Text style={styles.error}>{t('common.error')}</Text>}

      <Text style={styles.description}>{pick(product.descriptionFa, product.descriptionEn)}</Text>

      {related.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('product.related')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.relatedRow}>
              {related.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.relatedCard}
                  onPress={() => router.push(`/product/${item.slug}`)}
                >
                  <ProductImage uri={item.image} style={styles.relatedImage} />
                  <Text numberOfLines={2} style={styles.relatedTitle}>
                    {pick(item.nameFa, item.nameEn)}
                  </Text>
                  <Text style={styles.relatedPrice}>{formatPrice(item.priceToman)}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  center: { paddingVertical: 64 },
  hero: { width: '100%', aspectRatio: 1, borderRadius: 20, backgroundColor: '#f1f5f9' },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  category: { fontSize: 13, color: '#64748b' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  price: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  oldPrice: { fontSize: 15, color: '#94a3b8', textDecorationLine: 'line-through' },
  stock: { fontSize: 13, fontWeight: '700', color: '#15803d' },
  outOfStock: { color: '#dc2626' },
  section: { gap: 8, marginTop: 6 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  label: { fontSize: 13, fontWeight: '700', color: '#475569' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  optionActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  optionDisabled: { opacity: 0.4 },
  optionText: { fontWeight: '700', color: '#334155' },
  optionTextActive: { color: '#fff' },
  addButton: {
    backgroundColor: '#ea580c',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonDisabled: { opacity: 0.5 },
  addButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  error: { color: '#dc2626', fontWeight: '600' },
  description: { lineHeight: 26, color: '#475569', fontSize: 15, marginTop: 8 },
  relatedRow: { flexDirection: 'row', gap: 12 },
  relatedCard: {
    width: 150,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    gap: 4,
  },
  relatedImage: { width: '100%', aspectRatio: 1, borderRadius: 10 },
  relatedTitle: { fontWeight: '700', fontSize: 13, color: '#0f172a' },
  relatedPrice: { fontWeight: '800', fontSize: 13, color: '#0f172a' },
});
