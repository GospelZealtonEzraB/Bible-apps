import { Platform } from 'react-native';
import Constants from 'expo-constants';

const REMINDER_ID = 'engraved-daily-reminder';

/**
 * Expo Go (SDK 53+) strips out the push-notification native module and prints a
 * noisy warning the moment `expo-notifications` is imported. We therefore load
 * it lazily and only in environments that actually support it (a dev/standalone
 * build), so Expo Go never evaluates the module. Reminders light up
 * automatically once the app is run as a real build.
 */
export const NOTIFICATIONS_SUPPORTED =
  Platform.OS !== 'web' &&
  Constants.executionEnvironment !== 'storeClient'; // 'storeClient' === Expo Go

function getNotifications():
  | typeof import('expo-notifications')
  | null {
  if (!NOTIFICATIONS_SUPPORTED) return null;
  // Loaded lazily so Expo Go never evaluates the native push module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications');
}

/** Configure how notifications are presented while the app is foregrounded. */
export function configureNotificationHandler(): void {
  const N = getNotifications();
  if (!N) return;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const N = getNotifications();
  if (!N) return false;
  const settings = await N.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await N.requestPermissionsAsync();
  return req.granted;
}

/**
 * Get this device's Expo push token so a partner's activity can notify it.
 * Returns null in Expo Go / web / when permission is denied.
 */
export async function getExpoPushToken(): Promise<string | null> {
  const N = getNotifications();
  if (!N) return null;
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;
    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;
    const res = await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return res.data ?? null;
  } catch {
    return null;
  }
}

/** Parse 'HH:MM' into { hour, minute }; returns null when invalid. */
export function parseTime(time: string): { hour: number; minute: number } | null {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Schedule (or reschedule) a repeating daily reminder at the given local time.
 * No-ops (returns false) on web and in Expo Go. Returns true when scheduled.
 */
export async function scheduleDailyReminder(time: string): Promise<boolean> {
  const N = getNotifications();
  if (!N) return false;
  const parsed = parseTime(time);
  if (!parsed) return false;

  const granted = await requestNotificationPermission();
  if (!granted) return false;

  await cancelDailyReminder();
  await N.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: 'Time to hide the Word in your heart 📖',
      body: 'A few verses are ready for review. Keep your streak alive!',
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.DAILY,
      hour: parsed.hour,
      minute: parsed.minute,
    },
  });
  return true;
}

export async function cancelDailyReminder(): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  try {
    await N.cancelScheduledNotificationAsync(REMINDER_ID);
  } catch {
    // No existing reminder scheduled — nothing to cancel.
  }
}
