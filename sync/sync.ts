import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import NetInfo from '@react-native-community/netinfo';
import { drainOutbox } from './outbox';

const SYNC_TASK = 'sync-outbox-task';

TaskManager.defineTask(SYNC_TASK, async () => {
  try {
    const st = await NetInfo.fetch();
    if (!st.isConnected) return BackgroundFetch.BackgroundFetchResult.NoData;
    await drainOutbox();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerSyncTask() {
  await BackgroundFetch.registerTaskAsync(SYNC_TASK, {
    minimumInterval: 60,
    stopOnTerminate: false,
    startOnBoot: true
  });
}