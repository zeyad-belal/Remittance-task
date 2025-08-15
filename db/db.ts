// db/db.ts — Expo SQLite async API (SDK 51+)
import * as SQLite from 'expo-sqlite';

// Lazily open and cache the DB connection
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
export async function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('app.db');
  }
  return dbPromise;
}

// Initialize schema in one bulk statement (WAL for reliability)
export async function initDb() {
  const db = await getDb();
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
  `);
}

// SELECT helpers
export async function query<T = any>(sql: string, params: any = []): Promise<T[]> {
  const db = await getDb();
  if (Array.isArray(params)) return db.getAllAsync<T>(sql, params);
  if (params && typeof params === 'object') return db.getAllAsync<T>(sql, params as Record<string, any>);
  return db.getAllAsync<T>(sql);
}

// INSERT/UPDATE/DELETE helpers
export async function exec(sql: string, params: any = []): Promise<{ changes: number; lastInsertRowId?: number } | void> {
  const db = await getDb();
  if (Array.isArray(params)) {
    return db.runAsync(sql, params);
  } else if (params && typeof params === 'object') {
    return db.runAsync(sql, params as Record<string, any>);
  } else {
    return db.runAsync(sql);
  }
}
export async function all(sql: string, params: any[] = []) {
  const db = await getDb();

  const stmt = await db.prepareAsync(sql);
  try {
    return await stmt.getAllAsync(params);   // returns an array
  } finally {
    await stmt.finalizeAsync();
  }
}



// Prepared statement helper
export async function prepare(sql: string) {
  const db = await getDb();
  return db.prepareAsync(sql);
}

// Transaction helper
export async function withTransaction(fn: (db: SQLite.SQLiteDatabase) => Promise<void>) {
  const db = await getDb();
  return db.withTransactionAsync(() => fn(db));
}

// Optional default export if you prefer to await a ready DB elsewhere
const dbProxy = {
  async ready() { return getDb(); }
} as const;

export default dbProxy;