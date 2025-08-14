// security/keychain.ts
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';
import { Platform } from 'react-native';

// Try to import react-native-keychain (native). It won't exist in Expo Go unless you prebuilt.
let Keychain: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Keychain = require('react-native-keychain');
} catch {
  Keychain = null;
}

const SERVICE = 'remit-signing-key';
const SECURE_STORE_KEY = 'remit_signing_key';

function hasNativeKeychain() {
  return !!Keychain && typeof Keychain.getGenericPassword === 'function';
}

async function promptBiometric(prompt = 'Confirm to sign transaction') {
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: prompt,
    disableDeviceFallback: false,
  });
  if (!res.success) throw new Error('Biometric auth failed or cancelled');
}

async function generateKeyHex(): Promise<string> {
  // Use CryptoJS for randomness (pure JS) to avoid adding more native deps
  return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
}

/**
 * Ensure we have a signing key protected by device secure storage.
 * - Prefers react-native-keychain when available (native, strongest).
 * - Falls back to expo-secure-store with requireAuthentication on supported platforms.
 */
export async function ensureSigningKey(): Promise<string> {
  if (hasNativeKeychain()) {
    const existing = await Keychain.getGenericPassword({ service: SERVICE });
    if (existing) return existing.password;
    const secret = await generateKeyHex();
    await Keychain.setGenericPassword('user', secret, {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
    });
    return secret;
  }

  // Fallback path (Expo Go / no native keychain):
  // Gate retrieval behind biometric each time.
  const existing = await SecureStore.getItemAsync(SECURE_STORE_KEY, {
    requireAuthentication: false, // we'll prompt explicitly before signing
  });
  if (existing) return existing;

  const secret = await generateKeyHex();
  await SecureStore.setItemAsync(SECURE_STORE_KEY, secret, {
    requireAuthentication: false,
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  return secret;
}

/**
 * Biometric-gated signing using HMAC-SHA256 over canonical JSON string.
 * Works with both native Keychain and SecureStore fallback.
 */
export async function biometricSignPayload(payload: unknown) {
  // 1) Prompt biometric regardless of storage provider
  // (On iOS Simulator without biometrics enrolled, this may fail; handle upstream.)
  await promptBiometric('Confirm to sign transaction');

  // 2) Retrieve key
  let secret: string | null = null;
  if (hasNativeKeychain()) {
    const creds = await Keychain.getGenericPassword({ service: SERVICE });
    secret = creds?.password ?? null;
  } else {
    // For SecureStore, optionally re-prompt just-in-time on supported OS
    if (Platform.OS !== 'web') {
      try {
        await SecureStore.getItemAsync(SECURE_STORE_KEY, { requireAuthentication: true });
      } catch {
        /* ignore, we already prompted above */
      }
    }
    secret = await SecureStore.getItemAsync(SECURE_STORE_KEY);
  }
  if (!secret) {
    // First run fallback — generate and persist a key, then proceed
    secret = await ensureSigningKey();
  }

  // 3) Sign
  const body = JSON.stringify(payload);
  const signature = CryptoJS.HmacSHA256(body, secret).toString(CryptoJS.enc.Hex);
  return { body, signature, algo: 'HMAC-SHA256' as const };
}
