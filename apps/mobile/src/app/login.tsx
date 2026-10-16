import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError } from '@mehrwearing/api-client';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/state';

/** Sign in / register in one screen (the starter keeps the flow minimal). */
export default function LoginScreen() {
  const { t } = useI18n();
  const { signIn, register } = useSession();
  const router = useRouter();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await signIn(email.trim(), password);
      else await register({ email: email.trim(), password, fullName: fullName.trim() });
      router.back();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'common.error';
      setError(
        code === 'INVALID_CREDENTIALS' || code === 'VALIDATION_ERROR'
          ? 'auth.invalid'
          : 'common.error',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>{t('auth.loginTitle')}</Text>

        {mode === 'register' && (
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder={t('auth.fullName')}
            style={styles.input}
          />
        )}
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.email')}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.password')}
          secureTextEntry
          style={styles.input}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={() => void submit()}
          disabled={busy}
          style={[styles.button, busy && styles.buttonBusy]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {mode === 'login' ? t('auth.loginCta') : t('auth.registerCta')}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
          style={styles.switch}
        >
          <Text style={styles.switchText}>
            {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}{' '}
            <Text style={styles.switchAction}>
              {mode === 'login' ? t('auth.registerCta') : t('auth.loginCta')}
            </Text>
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16, justifyContent: 'center' },
  card: {
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  error: { color: '#dc2626', fontWeight: '600' },
  button: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonBusy: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  switch: { alignItems: 'center', paddingVertical: 4 },
  switchText: { color: '#64748b', fontSize: 14 },
  switchAction: { color: '#ea580c', fontWeight: '800' },
});
