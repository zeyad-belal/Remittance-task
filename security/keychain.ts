import * as Keychain from 'react-native-keychain';
import * as LocalAuthentication from 'expo-local-authentication';
import CryptoJS from 'crypto-js';

const SERVICE = 'remit-signing-key';

export async function ensureSigningKey(): Promise<string> {
  const existing = await Keychain.getGenericPassword({ service: SERVICE });
  if (existing) return existing.password;

  const random = Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))
    .map((n) => n.toString(16).padStart(2, '0')).join('');
  await Keychain.setGenericPassword('user', random, {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE, // extra protection at OS level
  });
  return random;
}

export async function biometricSignPayload(payload: unknown) {
  // 1) Prompt biometric
  const ok = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Confirm to sign transaction',
    disableDeviceFallback: false,
  });
  if (!ok.success) throw new Error('Biometric auth failed/cancelled');

  // 2) Fetch secret from Keychain
  const creds = await Keychain.getGenericPassword({ service: SERVICE });
  if (!creds) throw new Error('Signing key missing');
  const secret = creds.password;

  // 3) HMAC-SHA256 over canonical JSON string
  const body = JSON.stringify(payload);
  const sig = CryptoJS.HmacSHA256(body, secret).toString(CryptoJS.enc.Hex);
  return { body, signature: sig, algo: 'HMAC-SHA256' };
}