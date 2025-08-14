// services/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Show alerts in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // New NotificationBehavior API (SDK 53): use banner/list flags instead of shouldShowAlert
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidTxChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('tx-updates', {
    name: 'Transaction Updates',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableVibrate: true,
    enableLights: true,
    lightColor: '#FF00FF',
  });
}

/**
 * Registers for push notifications and returns an Expo push token (or null on simulator).
 * This configures the Android notification channel and asks for user permissions.
 */
export async function registerPush() {
  if (!Device.isDevice) {
    // Remote push tokens aren't available on simulators; local notifications still work.
    return null;
  }

  // Permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  await ensureAndroidTxChannel();

  // Get Expo push token (send to backend in a real app)
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  return token;
}

/**
 * Local notification for when a transaction moves to Completed.
 */
export async function notifyTxCompleted(opts: { amount: number; currency: string; remoteId?: string }) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Transfer Completed',
      body: `Your ${opts.amount} ${opts.currency} transfer is complete${opts.remoteId ? ' (' + opts.remoteId + ')' : ''}.`,
      data: { type: 'tx.completed', ...opts },
    },
    trigger: null,
  });
}

/**
 * Generic local notification helper for other transaction statuses.
 */
export async function notifyTxStatus(title: string, body: string, data?: Record<string, any>) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { type: 'tx.status', ...(data ?? {}) } },
    trigger: null,
  });
}
