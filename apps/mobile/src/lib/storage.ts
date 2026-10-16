import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Token storage for the mobile client.
 *
 * Native: expo-secure-store (Keychain / Keystore — hardware-backed, not
 * readable by other apps). Web: localStorage, which is why the web build is
 * a preview target only (production auth for web lives in the Next.js BFF
 * with httpOnly cookies instead).
 */
const available = Platform.OS !== 'web' && SecureStore.isAvailableAsync !== undefined;

export async function getItem(key: string): Promise<string | null> {
  if (!available)
    return Platform.OS === 'web' ? (globalThis.localStorage?.getItem(key) ?? null) : null;
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (!available) {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (!available) {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
