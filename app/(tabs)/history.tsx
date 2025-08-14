import { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

type TxRow = {
  id: number;
  status: string;
  amount: number;
  currency: string;
  errorText: string | null;
};

export default function HistoryTab() {
  const [rows, setRows] = useState<TxRow[]>([]);
  const db = useSQLiteContext();

  useEffect(() => {
    async function fetchRows() {
      const results = await db.getAllAsync<TxRow>('SELECT * FROM tx ORDER BY created_at DESC');
      setRows(results);
    }
    fetchRows();
  }, [db]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      {rows.map(r => (
        <View key={String(r.id)} style={{ padding: 12, borderWidth: 1, borderRadius: 8 }}>
          <Text>ID: {String(r.id)}</Text>
          <Text>Status: {r.status}</Text>
          <Text>Amount: {r.amount} {r.currency}</Text>
          {!!r.errorText && <Text style={{ color: 'red' }}>{r.errorText}</Text>}
        </View>
      ))}
    </ScrollView>
  );
}