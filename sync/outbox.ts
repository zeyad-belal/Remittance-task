import * as SQLite from 'expo-sqlite';
import { postTx } from '@features/tx/api';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
async function getDb() {
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync('app.db');
  return dbPromise;
}

export async function enqueue(op: string, entity: string, entityId: string, payload: any) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO outbox (id, entity, entityId, op, payloadJson, createdAt, retryCount)
    VALUES (?,?,?,?,?,?,0)`,
    [String(Date.now()) + Math.random(), entity, entityId, op, JSON.stringify(payload), Date.now()]
  );
}

export async function drainOutbox(limit = 10) {
  const db = await getDb();
  try {
    const rows = await db.getAllAsync(`SELECT * FROM outbox ORDER BY createdAt LIMIT ?`, [limit]);

    for (const item of rows as {
      id: string;
      entity: string;
      entityId: string;
      op: string;
      payloadJson: string;
      createdAt: number;
      retryCount: number;
    }[]) {
      const payload = JSON.parse(item.payloadJson);

      if (item.entity === 'tx' && item.op === 'CREATE') {
        await db.withTransactionAsync(async () => {
          await postTx(payload);
          await db.runAsync(`UPDATE tx SET status='Completed', remoteId=? WHERE id=?`, [
            payload.id,
            item.entityId,
          ]);
          await db.runAsync(`DELETE FROM outbox WHERE id=?`, [item.id]);
        });
      }

      if (item.entity === 'kyc_docs' && item.op === 'KYC_UPLOAD') {
        await db.withTransactionAsync(async () => {
          await db.runAsync(`UPDATE kyc_docs SET remoteId=? WHERE id=?`, [
            'remote-' + item.entityId,
            item.entityId,
          ]);
          await db.runAsync(`DELETE FROM outbox WHERE id=?`, [item.id]);
        });
      }
    }
  } catch (e) {
    throw e;
  }
}
