import * as Crypto from 'expo-crypto';
import * as Keychain from 'react-native-keychain';

const SERVICE = 'remit_signing_key_v1';

export async function getOrCreateSigningKey(): Promise<string> {
  const existing = await Keychain.getGenericPassword({ service: SERVICE });
  if (existing) return existing.password;

  const secret = (await Crypto.getRandomBytesAsync(32)).toString();
  await Keychain.setGenericPassword('user', secret, {
    service: SERVICE,
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE
  });
  return secret;
}

export async function signPayload(payload: object): Promise<string> {
  const creds = await Keychain.getGenericPassword({
    service: SERVICE,
    authenticationPrompt: { title: 'Authenticate to sign' }
  });
  if (!creds) throw new Error('Biometric auth failed');

  const base = JSON.stringify(payload);
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${base}|${creds.password}`);
}