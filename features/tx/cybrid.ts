import NetInfo from '@react-native-community/netinfo';

// tiny cache to avoid repeated fetches offline
let lastRate: { pair: string; rate: number; feePct: number; ts: number } | null = null;

export async function fetchMockRate(pair: 'USD-SLL' | string) {
  // simulate Sierra Leone latency + jitter
  const delay = 400 + Math.random() * 800;
  await new Promise((r) => setTimeout(r, delay));

  const net = await NetInfo.fetch();
  if (!net.isConnected) {
    // offline: return cached rate if available, else a safe default
    return lastRate ?? { pair, rate: 22_500, feePct: 0.01, ts: Date.now() };
  }

  // pretend we hit Cybrid: vary rate a bit, add a 1% fee
  const base = 23_000;
  const wiggle = (Math.random() - 0.5) * 600; // ±300
  const rate = Math.max(18_000, Math.round(base + wiggle));
  const feePct = 0.01;

  lastRate = { pair, rate, feePct, ts: Date.now() };
  return lastRate;
}