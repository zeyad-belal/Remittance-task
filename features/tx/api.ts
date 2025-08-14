import Constants from 'expo-constants';

const base = (Constants.expoConfig as any)?.extra?.mockApiBase || 'http://localhost:4000';

export async function fetchMockRate(pair: string): Promise<{ rate: number; fee: number }> {
  const r = await fetch(`${base}/rate?pair=${encodeURIComponent(pair)}`);
  if (!r.ok) throw new Error('rate fetch failed');
  return r.json();
}

export async function postTx(body: any) {
  const res = await fetch(`${base}/tx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': body.id },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}