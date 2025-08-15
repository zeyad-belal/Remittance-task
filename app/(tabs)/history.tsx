// app/(tabs)/history.tsx (example)
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { exec } from '@db/db';

type Tx = {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  rate: number;
  fee: number;
  toAddress: string;
  status: string;
  createdAt: number;
};

export default function HistoryTab() {
  const [items, setItems] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  const debugLog = (rows: Tx[]) => {
    try {
      console.log("TX rows count:", rows.length);
      if (rows[0]) console.log("First row sample:", rows[0]);
    } catch {}
  };

  useEffect(() => {
    (async () => {
      try {
        // make sure tables exist
        await exec(`
          CREATE TABLE IF NOT EXISTS tx (
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
          );
        `, []);

        // Prepare the statement, read all rows, then finalize (expo-sqlite async API)
        const stmt = await exec(
          "SELECT * FROM tx ORDER BY createdAt DESC",
          []
        );
        const rows = (await stmt.getAllAsync<Tx>()) ?? [];
        await stmt.finalizeAsync();
        setItems(rows);
        debugLog(rows);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <View style={{padding:16}}><Text>Loading…</Text></View>;
  if (!items.length) return <View style={{padding:16}}><Text>No transactions yet.</Text></View>;

  return (
    <FlatList
      data={items}
      keyExtractor={(x) => x.id}
      renderItem={({ item }) => (
        <View style={{ padding:12, borderBottomWidth:1, borderColor:'#eee' }}>
          <Text>{item.status} • {new Date(item.createdAt).toLocaleString()}</Text>
          <Text>{item.amount} {item.currency} → {item.toAddress}</Text>
          <Text style={{opacity:0.6}}>Rate {item.rate} • Fee {item.fee}</Text>
        </View>
      )}
    />
  );
}