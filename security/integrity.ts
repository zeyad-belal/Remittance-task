import JailMonkey from 'jail-monkey';

export function ensureIntegrity() {
  const compromised = JailMonkey.isJailBroken() || JailMonkey.trustFall() || JailMonkey.hookDetected();
  if (compromised) throw new Error('Compromised device detected');
}