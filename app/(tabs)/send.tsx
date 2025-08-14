import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { exec } from '@db/db';
import { fetchMockRate } from '@features/tx/api';
import { signPayload } from '@security/keychain';
import { ensureIntegrity } from '@security/integrity';
import { enqueue } from '@sync/outbox';

export default function SendTab() {
  const [amount, setAmount] = useState('100');
  const [toAddress, setTo] = useState('recipient-123');
  const [currency] = useState('USD');

  async function onSend() {
    try {
      ensureIntegrity();
      const { rate, fee } = await fetchMockRate('USD-SLL');
      const id = String(Date.now());
      const payload = {
        id,
        userId: 'demo-user',
        amount: Number(amount),
        currency,
        toAddress,
        rate,
        fee,
        ts: Date.now(),
      };
      const signedPayload = await signPayload(payload);

      await exec(
        `INSERT INTO tx (id,userId,amount,currency,rate,fee,toAddress,status,createdAt,signedPayload)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          id,
          'demo-user',
          Number(amount),
          currency,
          rate,
          fee,
          toAddress,
          'Created',
          Date.now(),
          signedPayload,
        ]
      );

      enqueue('CREATE', 'tx', id, { ...payload, signedPayload });
      Alert.alert('Queued', 'Transaction queued (offline-first).');
    } catch (e: any) {
      Alert.alert('Error', e.message || String(e));
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text>Amount (USD)</Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        style={{ borderWidth: 1, padding: 8, borderRadius: 8 }}
      />
      <Text>To</Text>
      <TextInput
        value={toAddress}
        onChangeText={setTo}
        style={{ borderWidth: 1, padding: 8, borderRadius: 8 }}
      />
      <TouchableOpacity
        onPress={onSend}
        style={{ padding: 16, backgroundColor: '#0A7', borderRadius: 10 }}>
        <Text style={{ color: 'white', fontWeight: 'bold' }}>Send (biometric sign)</Text>
      </TouchableOpacity>
    </View>
  );
}
