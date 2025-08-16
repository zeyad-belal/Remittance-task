// app/(tabs)/history.tsx — refreshed to match latest SQLite + Cybrid logic
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { exec } from '@db/db';
import { Cybrid } from '@services/cybrid';

// Keep in sync with src/db schema
export type Tx = {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  rate: number;
  fee: number;
  toAddress: string;
  status: string;
  createdAt: number;
  signedPayload?: string | null;
};

// Ensure the local tables exist (idempotent)
async function ensureTables() {
  await exec(
    `CREATE TABLE IF NOT EXISTS tx (
      id TEXT PRIMARY KEY,
      userId TEXT,
      amount REAL,
      currency TEXT,
      rate REAL,
      fee REAL,
      toAddress TEXT,
      status TEXT,
      createdAt INTEGER,
      signedPayload TEXT
    );`,
    []
  );
}

// Normalise various shapes returned by different exec wrappers
async function readAll(sql: string, params: any[] = []): Promise<Tx[]> {
  const res: any = await exec(sql, params);

  // Case 1: our exec already returns an array of rows
  if (Array.isArray(res)) return res as Tx[];

  // Case 2: expo-sqlite style { rows: { _array: [...] } }
  if (res?.rows?._array) return (res.rows._array as Tx[]) ?? [];

  // Case 3: async prepared statement with getAllAsync/finalizeAsync
  if (typeof res?.getAllAsync === 'function') {
    const rows = (await res.getAllAsync()) as Tx[];
    if (typeof res?.finalizeAsync === 'function') await res.finalizeAsync();
    return rows ?? [];
  }

  return [];
}

// Optionally pull recent trades from Cybrid and merge into local table
async function pullTradesIntoLocal(customerGuid: string) {
  try {
    const listTradesFn = Cybrid?.trades?.listTrades || Cybrid?.trade?.listTrades;
    if (!listTradesFn) return; // SDK not wired yet

    // Some SDKs are observable-based; support both promise & observable
    const maybe$ = listTradesFn({ customerGuid, page: 0, perPage: 50 });
    const result: any = typeof maybe$?.subscribe === 'function'
      ? await new Promise((resolve, reject) => {
          const sub = maybe$.subscribe({ next: resolve, error: reject, complete: () => sub?.unsubscribe?.() });
        })
      : await maybe$;

    const objects: any[] = result?.objects || result?.data || [];

    for (const t of objects) {
      await exec(
        `INSERT OR REPLACE INTO tx (id,userId,amount,currency,rate,fee,toAddress,status,createdAt,signedPayload)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          t.guid,
          'demo-user',
          Number(t.deliver_amount ?? t.amount ?? 0),
          // Symbol like BTC-USD -> take quote currency to align with send screen display
          String(t.symbol || '').split('-')[1] || 'USD',
          0,
          0,
          t.to_address || '',
          t.state || 'submitted',
          t.created_at ? new Date(t.created_at).getTime() : Date.now(),
          '',
        ]
      );
    }
  } catch (err) {
    console.warn('pullTradesIntoLocal failed:', err);
  }
}

export default function HistoryTab() {
  const [items, setItems] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await ensureTables();

      // Merge remote trades if customer is known (optional; no-op if not configured)
      const customerGuid = process.env.EXPO_PUBLIC_CYBRID_CUSTOMER_GUID || '';
      if (customerGuid) {
        await pullTradesIntoLocal(customerGuid);
      }

      const rows = await readAll('SELECT * FROM tx ORDER BY createdAt DESC', []);
      setItems(rows);
      console.log('History load -> rows:', rows.length);
      if (rows[0]) console.log('Sample row:', rows[0]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      // Reload whenever the tab gains focus (after sending a tx, etc.)
      load();
      return () => {};
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <View style={{ padding: 16 }}>
        <Text>Loading…</Text>
      </View>
    );
  }

  if (!items.length) {
    return (
      <View style={{ padding: 16 }}>
        <Text>No transactions yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(x) => x.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      renderItem={({ item }) => (
        <View style={{ padding: 12, borderBottomWidth: 1, borderColor: '#eee' }}>
          <Text>
            {item.status} • {new Date(item.createdAt).toLocaleString()}
          </Text>
          <Text>
            {Number(item.amount).toLocaleString()} {item.currency}
            {item.toAddress ? ` → ${item.toAddress}` : ''}
          </Text>
          <Text style={{ opacity: 0.6 }}>Rate {item.rate} • Fee {item.fee}</Text>
        </View>
      )}
    />
  );
}