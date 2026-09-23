import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

export const CHANNELS = { focus: 'focus', reminders: 'reminders' } as const;

let ready: Promise<void> | null = null;

/** Foreground presentation + Android channels. Safe to call repeatedly. */
export function initNotifications(): Promise<void> {
  ready ??= (async () => {
    Notifications.setNotificationHandler({
      handleNotification: async (n) => {
        // The app plays its own bell and modal when a focus run ends in the foreground.
        const inApp = n.request.content.data?.kind === 'focus' && AppState.currentState === 'active';
        return { shouldPlaySound: !inApp, shouldSetBadge: false, shouldShowBanner: !inApp, shouldShowList: !inApp };
      },
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNELS.focus, {
        name: 'Focus sessions',
        description: 'When a focus session or break ends',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'focus_bell.wav',
        vibrationPattern: [0, 200, 120, 200],
      });
      await Notifications.setNotificationChannelAsync(CHANNELS.reminders, {
        name: 'Reminders',
        description: 'Habit reminders and daily nudges',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
  })().catch(() => {});
  return ready;
}

/** Ask once, only when a feature first needs it. */
export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  return next.granted;
}

export async function scheduleAt(date: Date, content: Notifications.NotificationContentInput, channelId: string = CHANNELS.focus) {
  if (Platform.OS === 'web') return null;
  await initNotifications();
  if (!(await ensurePermission())) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { sound: Platform.OS === 'ios' ? 'focus_bell.wav' : undefined, ...content },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId },
    });
  } catch {
    return null;
  }
}

export async function cancel(id: string | null | undefined) {
  if (!id || Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}
