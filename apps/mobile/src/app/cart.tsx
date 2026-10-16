import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useI18n } from '@/lib/i18n';
import { useCart, useSession } from '@/lib/state';
import { ProductImage } from '@/components/product-image';

/**
 * Cart screen. Checkout stays on the storefront (payment gateway flow,
 * addresses and coupons all live there) — this screen links into the account
 * so the mobile app never reimplements the purchase pipeline.
 */
export default function CartScreen() {
  const { t, formatPrice, pick } = useI18n();
  const { cart, setQty, remove } = useCart();
  const { user } = useSession();
  const router = useRouter();

  const items = cart?.items ?? [];

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text style={styles.emptyText}>{t('cart.empty')}</Text>
        <Pressable onPress={() => router.push('/')} style={styles.outlineButton}>
          <Text style={styles.outlineButtonText}>{t('nav.catalog')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list}>
        {items.map((item) => (
          <View key={item.variantId} style={styles.row}>
            <ProductImage uri={item.product.image} style={styles.image} />
            <View style={styles.info}>
              <Text numberOfLines={2} style={styles.title}>
                {pick(item.product.nameFa, item.product.nameEn)}
              </Text>
              <Text style={styles.price}>{formatPrice(item.unitPriceToman)}</Text>

              <View style={styles.actions}>
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => void setQty(item.variantId, item.qty - 1)}
                    style={styles.step}
                  >
                    <Text style={styles.stepText}>−</Text>
                  </Pressable>
                  <Text style={styles.qty}>{item.qty}</Text>
                  <Pressable
                    onPress={() => void setQty(item.variantId, item.qty + 1)}
                    style={styles.step}
                  >
                    <Text style={styles.stepText}>+</Text>
                  </Pressable>
                </View>
                <Pressable onPress={() => void remove(item.variantId)}>
                  <Text style={styles.remove}>{t('cart.remove')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('cart.subtotal')}</Text>
          <Text style={styles.summaryValue}>{formatPrice(cart?.subtotalToman ?? 0)}</Text>
        </View>
        <Pressable
          onPress={() => router.push(user ? '/account' : '/login')}
          style={styles.checkout}
        >
          <Text style={styles.checkoutText}>
            {user ? t('cart.checkout') : t('cart.loginToBuy')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  list: { padding: 12, gap: 12 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    padding: 24,
  },
  emptyIcon: { fontSize: 44 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#334155' },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  outlineButtonText: { fontWeight: '700', color: '#0f172a' },
  row: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  image: { width: 84, height: 84, borderRadius: 12 },
  info: { flex: 1, gap: 4 },
  title: { fontWeight: '700', color: '#0f172a', fontSize: 15, lineHeight: 21 },
  price: { fontWeight: '800', color: '#0f172a' },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    overflow: 'hidden',
  },
  step: { paddingHorizontal: 12, paddingVertical: 6 },
  stepText: { fontSize: 16, fontWeight: '700', color: '#334155' },
  qty: { minWidth: 28, textAlign: 'center', fontWeight: '800', color: '#0f172a' },
  remove: { color: '#94a3b8', fontWeight: '700', fontSize: 13 },
  summary: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: 16,
    gap: 12,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: '#64748b', fontWeight: '600' },
  summaryValue: { fontWeight: '900', fontSize: 18, color: '#0f172a' },
  checkout: {
    backgroundColor: '#ea580c',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  checkoutText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
