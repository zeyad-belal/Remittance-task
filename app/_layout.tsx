import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { drainOutbox } from '@sync/outbox';
import { registerSyncTask } from '@sync/sync';
import { registerPush } from '@services/notifications';
import NetInfo from '@react-native-community/netinfo';

// Run schema migrations on first load / version change
async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 1;
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const user_version = result?.user_version ?? 0;
  if (user_version >= DATABASE_VERSION) return;

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT, kycStatus TEXT, createdAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS kyc_docs (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT, uri TEXT, mime TEXT, uploadedAt INTEGER, remoteId TEXT
    );
    CREATE TABLE IF NOT EXISTS tx (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT, amount REAL, currency TEXT,
      rate REAL, fee REAL, toAddress TEXT,
      status TEXT, createdAt INTEGER, lastAttemptAt INTEGER,
      remoteId TEXT, signedPayload TEXT, errorText TEXT
    );
    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY NOT NULL,
      entity TEXT, entityId TEXT, op TEXT, payloadJson TEXT,
      createdAt INTEGER, retryCount INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_outbox_created ON outbox(createdAt);
    PRAGMA user_version = ${DATABASE_VERSION};
  `);
}

export default function RootLayout() {

  useEffect(() => {
  registerSyncTask();

  (async () => {
    try {
      const token = await registerPush();
      if (__DEV__) console.log('Expo push token:', token);
    } catch (e) {
      console.warn('Push registration failed:', e);
    }
  })();

  const unsub = NetInfo.addEventListener(s => {
    if (s.isConnected) drainOutbox().catch(() => {});
  });
  return () => unsub();
}, []);

  return (
    <SQLiteProvider databaseName="app.db" onInit={migrateDbIfNeeded}>
      <Stack screenOptions={{ headerShown: false }} />
    </SQLiteProvider>
  );
}