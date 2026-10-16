import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useI18n, LOCALES, type Locale } from '@/lib/i18n';
import { useSession } from '@/lib/state';

/**
 * Account screen: identity, language switch and sign-out. Orders, addresses
 * and checkout are intentionally handled by the storefront, which the button
 * below opens.
 */
export default function AccountScreen() {
  const { t, locale, setLocale, isRtl } = useI18n();
  const { user, signOut, ready } = useSession();
  const router = useRouter();

  if (!ready) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.name}>
          {user ? t('account.welcome', { name: user.fullName }) : t('account.guest')}
        </Text>
        {user && <Text style={styles.email}>{user.email}</Text>}

        {!user && (
          <Pressable onPress={() => router.push('/login')} style={styles.primaryButton}>
            <Text style={styles.primaryText}>{t('auth.loginCta')}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t('account.language')}</Text>
        <View style={styles.segment}>
          {LOCALES.map((entry: Locale) => (
            <Pressable
              key={entry}
              onPress={() => setLocale(entry)}
              style={[styles.segmentItem, locale === entry && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, locale === entry && styles.segmentTextActive]}>
                {entry === 'fa-IR' ? 'فارسی' : 'English'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.note}>{t('account.directionNote')}</Text>
        <Text style={styles.direction}>{isRtl ? 'RTL →' : '← LTR'}</Text>
      </View>

      {user && (
        <Pressable
          onPress={() => {
            void signOut().then(() => router.push('/'));
          }}
          style={styles.signOut}
        >
          <Text style={styles.signOutText}>{t('account.logout')}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 10,
  },
  name: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  email: { color: '#64748b', fontSize: 14 },
  label: { fontWeight: '700', color: '#475569', fontSize: 13 },
  primaryButton: {
    backgroundColor: '#ea580c',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800' },
  segment: { flexDirection: 'row', gap: 8 },
  segmentItem: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  segmentText: { fontWeight: '700', color: '#334155' },
  segmentTextActive: { color: '#fff' },
  note: { fontSize: 12, color: '#94a3b8' },
  direction: { fontSize: 12, color: '#94a3b8', fontWeight: '700' },
  signOut: {
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: { color: '#dc2626', fontWeight: '800' },
});
