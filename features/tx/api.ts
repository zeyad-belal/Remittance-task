export async function postTx(payload: any) {
  // Simulate remote POST with small delay
  await new Promise((r) => setTimeout(r, 500));
  // Return a fake remote id (what a backend would do)
  return { ok: true, id: 'rmt_' + payload.id };
}