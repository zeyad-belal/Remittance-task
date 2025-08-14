import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import NetInfo from '@react-native-community/netinfo';
import { drainOutbox } from '@sync/outbox';

export const OUTBOX_TASK = 'outbox-sync';

// 1) Define the JS task in global scope (not inside a component)
TaskManager.defineTask(OUTBOX_TASK, async () => {
  try {
    const net = await NetInfo.fetch();
    if (!net.isConnected) return BackgroundTask.BackgroundTaskResult.Success;
    await drainOutbox();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    console.warn('Outbox sync failed in background', e);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// 2) Register it somewhere at startup (e.g., in _layout.tsx useEffect)
export async function registerSyncTask() {
  try {
    // Runs occasionally in background; OS may wait beyond this minimum
    await BackgroundTask.registerTaskAsync(OUTBOX_TASK, { minimumInterval: 30 }); // minutes
  } catch (e) {
    console.warn('registerSyncTask failed', e);
  }
}