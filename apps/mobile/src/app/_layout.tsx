import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { AppProviders } from '@/lib/state';

/**
 * Root layout: providers first (Persian-first i18n, session, cart), then a
 * native stack. Each screen sets its own localized title so the header reads
 * correctly in both RTL (fa) and LTR (en).
 */
function StackWithTheme() {
  const { t } = useI18n();
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ title: t('nav.catalog') }} />
        <Stack.Screen name="product/[slug]" options={{ title: '' }} />
        <Stack.Screen name="cart" options={{ title: t('nav.cart') }} />
        <Stack.Screen name="login" options={{ title: t('auth.loginTitle') }} />
        <Stack.Screen name="account" options={{ title: t('nav.account') }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AppProviders>
          <StackWithTheme />
        </AppProviders>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
