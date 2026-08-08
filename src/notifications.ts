import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const REMINDER_ID = 'engraved-daily-reminder';

/** Configure how notifications are presented while the app is foregrounded. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
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
 * No-ops on web. Returns true when a reminder was scheduled.
 */
export async function scheduleDailyReminder(time: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const parsed = parseTime(time);
  if (!parsed) return false;

  const granted = await requestNotificationPermission();
  if (!granted) return false;

  await cancelDailyReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: 'Time to hide the Word in your heart 📖',
      body: 'A few verses are ready for review. Keep your streak alive!',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: parsed.hour,
      minute: parsed.minute,
    },
  });
  return true;
}

export async function cancelDailyReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
  } catch {
    // No existing reminder scheduled — nothing to cancel.
  }
}
