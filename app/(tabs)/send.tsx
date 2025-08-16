import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { fetchMockRate } from '@features/tx/cybrid';
import { biometricSignPayload, ensureSigningKey } from '@security/keychain';
import NetInfo from '@react-native-community/netinfo';
import { exec } from '@db/db'; // your async expo-sqlite helper
import { getUsdToAsset, createAndExecuteTrade } from '@services/cybrid';

// Simple timeout wrapper to prevent indefinite hangs on network calls
async function withTimeout<T>(promise: Promise<T>, ms: number, label = 'op'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout:${label}`)), ms)),
  ]) as Promise<T>;
}

async function ensureTables() {
  // tx table holds transactions shown in History
  await exec(
    `CREATE TABLE IF NOT EXISTS tx (
      id TEXT PRIMARY KEY NOT NULL,
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

  // outbox table holds queued ops for sync worker
  await exec(
    `CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY NOT NULL,
      entity TEXT,
      entityId TEXT,
      op TEXT,
      payloadJson TEXT,
      createdAt INTEGER,
      retryCount INTEGER DEFAULT 0
    );`,
    []
  );
}

export default function SendTab() {
  const [amount, setAmount] = useState('100');
  const [toAddress, setTo] = useState('recipient-123');
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);

  const FEE_PCT = 0.01; // adjust to your fee model
  const SYMBOL = 'USD-SLL'; // set to what your bank supports
  const CURRENCY = 'USD'; // display/base currency in your UI

  async function onSend() {
    if (sendingRef.current) return;
    setIsSending(true);
    sendingRef.current = true;

    try {
      await ensureTables(); // your sqlite table creation
      await ensureSigningKey(); // needed only if you keep biometric signing

      const net = await withTimeout(NetInfo.fetch(), 3000, 'netinfo').catch(() => ({ isConnected: false } as any));
      let rate = 0;
      try {
        if (net.isConnected) {
          rate = await getUsdToAsset(SYMBOL); // Cybrid price
        }
      } catch (_) {
        // keep rate = 0 if pricing unavailable
      }
      const amt = Number(amount);

      if (!Number.isFinite(amt) || amt <= 0) {
        Alert.alert('Invalid amount', 'Please enter a positive number.');
        sendingRef.current = false;
        setIsSending(false);
        return;
      }
      if (!toAddress?.trim()) {
        Alert.alert('Missing recipient', 'Please enter a destination.');
        sendingRef.current = false;
        setIsSending(false);
        return;
      }

      const fee = Math.round(amt * FEE_PCT * 100) / 100;
      const createdAt = Date.now();

      // Optional single biometric prompt (remove if you don’t want FaceID here)
      const payloadToSign = {
        side: 'sell',
        symbol: SYMBOL,
        amount: amt,
        currency: CURRENCY,
        toAddress,
        rate,
        fee,
        createdAt,
      };
      let signed: any = { signature: '' };
      try {
        signed = await biometricSignPayload(payloadToSign); // one prompt total
      } catch (err: any) {
        console.log('biometricSignPayload error:', err?.message || err);
        Alert.alert('Authentication canceled', 'Transaction not sent.');
        setIsSending(false);
        sendingRef.current = false;
        return;
      }

      if (net.isConnected) {
        // ONLINE: execute now on Cybrid
        try {
          const trade = await withTimeout(
            createAndExecuteTrade({
              customerGuid: '<YOUR_CUSTOMER_GUID>',
              symbol: SYMBOL,
              side: 'sell',
              amount: String(amt),
            }),
            10000,
            'trade'
          );

          await exec(
            `INSERT INTO tx (id,userId,amount,currency,rate,fee,toAddress,status,createdAt,signedPayload)
              VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [
              trade.guid,
              'demo-user',
              amt,
              CURRENCY,
              rate,
              fee,
              toAddress,
              trade.state || 'submitted',
              createdAt,
              signed.signature ?? '',
            ]
          );

          Alert.alert('Sent', 'Trade submitted successfully.');
        } catch (err: any) {
          console.log('trade exec failed, queuing offline:', err?.message || err);
          const localId = `local-${createdAt}`;

          await exec(
            `INSERT INTO tx (id,userId,amount,currency,rate,fee,toAddress,status,createdAt,signedPayload)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [
              localId,
              'demo-user',
              amt,
              CURRENCY,
              rate,
              fee,
              toAddress,
              'QueuedOffline',
              createdAt,
              signed.signature ?? '',
            ]
          );

          await exec(
            `INSERT INTO outbox (id,entity,entityId,op,payloadJson,createdAt,retryCount)
             VALUES (?,?,?,?,?,?,0)`,
            [
              String(Date.now()),
              'trade',
              localId,
              'CREATE',
              JSON.stringify({
                side: 'sell',
                symbol: SYMBOL,
                amount: String(amt),
                toAddress,
                signed,
                createdAt,
              }),
              createdAt,
            ]
          );

          Alert.alert('Queued (network)', 'Network issue or timeout — will sync when online.');
        }
      } else {
        // OFFLINE: record locally & queue for the sync worker
        console.log('offline path: inserting local tx and outbox entry');
        const localId = `local-${createdAt}`;

        await exec(
          `INSERT INTO tx (id,userId,amount,currency,rate,fee,toAddress,status,createdAt,signedPayload)
          VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [
            localId,
            'demo-user',
            amt,
            CURRENCY,
            rate,
            fee,
            toAddress,
            'QueuedOffline',
            createdAt,
            signed.signature ?? '',
          ]
        );

        await exec(
          `INSERT INTO outbox (id,entity,entityId,op,payloadJson,createdAt,retryCount)
         VALUES (?,?,?,?,?,?,0)`,
          [
            String(Date.now()),
            'trade',
            localId,
            'CREATE',
            JSON.stringify({
              side: 'sell',
              symbol: SYMBOL,
              amount: String(amt),
              toAddress,
              signed,
              createdAt,
            }),
            createdAt,
          ]
        );

        Alert.alert('Queued (offline)', 'Will sync when connection resumes.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? String(e));
    } finally {
      setIsSending(false);
      sendingRef.current = false;
    }
  }
  const [rate, setRate] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);

  useEffect(() => {
    (async () => {
      await ensureTables();
      setLoadingRate(true);

      const res = await exec(
        'SELECT id, status, amount, currency, createdAt FROM tx ORDER BY createdAt DESC',
        []
      );

      let rows: any[] = [];
      try {
        if (res?.getAllAsync) {
          // our helper returns an async wrapper
          rows = await res.getAllAsync();
        } else if (res?.rows?._array) {
          rows = res.rows._array;
        } else if (Array.isArray(res)) {
          rows = res;
        } else if (res?.rows) {
          rows = res.rows as any[];
        }
      } catch (err) {
        console.log('TX select normalize error:', err);
      }
      console.log('TX select -> raw:', res);
      console.log('TX select -> normalized rows:', rows);

      const countRes = await exec('SELECT COUNT(*) as c FROM tx', []);
      let count: number | undefined;
      if (countRes?.getFirstAsync) {
        const first = await countRes.getFirstAsync();
        count = first?.c ?? first?.['COUNT(*)'] ?? first?.count;
      } else if (countRes?.rows?._array?.length) {
        const first = countRes.rows._array[0];
        count = first?.c ?? first?.['COUNT(*)'] ?? first?.count;
      } else if (Array.isArray(countRes) && countRes.length) {
        const first = countRes[0];
        count = first?.c ?? first?.['COUNT(*)'] ?? first?.count;
      }
      console.log('TX count:', count);

      try {
        const net2 = await NetInfo.fetch();
        if (net2.isConnected) {
          const live = await getUsdToAsset('USD-SLL');
          setRate(live);
        } else {
          const r = await fetchMockRate('USD-SLL');
          setRate(r.rate);
        }
      } catch {
        const r = await fetchMockRate('USD-SLL');
        setRate(r.rate);
      }
      setLoadingRate(false);
    })();
  }, []);

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ opacity: 0.7 }}>
        {loadingRate
          ? 'Fetching rate (USD→SLL)…'
          : rate
            ? `Rate: ${rate.toLocaleString()} SLL / USD`
            : 'Rate unavailable (offline)'}
      </Text>
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
        disabled={isSending}
        style={{ padding: 16, backgroundColor: '#0A7', borderRadius: 10, opacity: isSending ? 0.6 : 1 }}>
        <Text style={{ color: 'white', fontWeight: 'bold' }}>{isSending ? 'Sending…' : 'Send (biometric sign)'}</Text>
      </TouchableOpacity>
    </View>
  );
}
