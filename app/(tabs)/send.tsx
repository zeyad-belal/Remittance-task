import React, { useState ,useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { fetchMockRate } from '@features/tx/cybrid';
import { biometricSignPayload, ensureSigningKey } from '@security/keychain';
import NetInfo from '@react-native-community/netinfo';
import { exec } from '@db/db'; // your async expo-sqlite helper

export default function SendTab() {
  const [amount, setAmount] = useState('100');
  const [toAddress, setTo] = useState('recipient-123');
  const currency = 'USD';

  async function onSend() {
    try {
      await ensureSigningKey();

      // 1) fetch rate (mock Cybrid)
      const { rate, feePct } = await fetchMockRate('USD-SLL');
      const fee = Math.round(Number(amount) * feePct * 100) / 100;

      // 2) build payload & biometric sign
      const txId = String(Date.now());
      const payload = {
        id: txId,
        userId: 'demo-user',
        amount: Number(amount),
        currency,
        toAddress,
        rate,
        fee,
        createdAt: Date.now(),
      };
      const signed = await biometricSignPayload(payload);

      // 3) write tx locally with status=Created
      await exec(
        `INSERT INTO tx (id,userId,amount,currency,rate,fee,toAddress,status,createdAt,signedPayload)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [txId, 'demo-user', payload.amount, currency, rate, fee, toAddress, 'Created', payload.createdAt, signed.signature]
      );

      // 4) if offline, queue; if online, still queue (sync worker will pop fast)
      await exec(
        `INSERT INTO outbox (id,entity,entityId,op,payloadJson,createdAt,retryCount)
         VALUES (?,?,?,?,?,?,0)`,
        [String(Date.now()) + Math.random(), 'tx', txId, 'CREATE', JSON.stringify({ ...payload, signed }), Date.now()]
      );

      const net = await NetInfo.fetch();
      Alert.alert(
        net.isConnected ? 'Queued (online)' : 'Queued (offline)',
        net.isConnected ? 'Will sync immediately.' : 'Will sync when connection resumes.'
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? String(e));
    }
  }


  const [rate, setRate] = useState<number | null>(null);
const [loadingRate, setLoadingRate] = useState(false);

useEffect(() => {
  (async () => {
    setLoadingRate(true);
    const r = await fetchMockRate('USD-SLL');
    setRate(r.rate);
    setLoadingRate(false);
  })();
}, []);


  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ opacity: 0.7 }}>
  {loadingRate ? 'Fetching rate (USD→SLL)…' : rate ? `Rate: ${rate.toLocaleString()} SLL / USD` : 'Rate unavailable (offline)'}
</Text>
      <Text>Amount (USD)</Text>
      <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" style={{ borderWidth: 1, padding: 8, borderRadius: 8 }} />
      <Text>To</Text>
      <TextInput value={toAddress} onChangeText={setTo} style={{ borderWidth: 1, padding: 8, borderRadius: 8 }} />
      <TouchableOpacity onPress={onSend} style={{ padding: 16, backgroundColor: '#0A7', borderRadius: 10 }}>
        <Text style={{ color: 'white', fontWeight: 'bold' }}>Send (biometric sign)</Text>
      </TouchableOpacity>
    </View>
  );
}