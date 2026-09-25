// Social push (docs/API.md v1.2): registers this device's FCM token with the server after
// sign-in (only when notification permission is already granted — never prompts here), and
// removes it on sign-out. Without Firebase configured (no google-services.json) getting the
// token throws and push is skipped silently; the inbox still works by polling.
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { onBeforeSignOut, useAuth } from '@/api/auth';
import { push } from '@/api/social';
import { refreshSocial } from '@/store/social';

const SOCIAL_TYPES = new Set(['nudge', 'cheer', 'friend_request', 'friend_accepted', 'invite_joined']);

/** Server push payload `data: { type, fromName }`. */
export const isSocialNotification = (data: unknown) =>
  !!data && typeof data === 'object' && SOCIAL_TYPES.has(String((data as { type?: unknown }).type));

/** Payload data: expo puts it in `content.data`; an FCM message tapped from the tray may carry it on the trigger. */
export function socialData(req: Notifications.NotificationRequest): unknown {
  const content = req.content.data;
  if (isSocialNotification(content)) return content;
  const trigger = req.trigger as { remoteMessage?: { data?: unknown } } | null;
  return trigger?.remoteMessage?.data ?? content;
}

let token: string | null = null;
let registeredFor: string | null = null;

async function deviceToken(): Promise<string | null> {
  // The server sends via FCM; iOS device tokens are APNs, so only Android registers for now.
  if (Platform.OS !== 'android') return null;
  try {
    const t = await Notifications.getDevicePushTokenAsync();
    return typeof t.data === 'string' ? t.data : null;
  } catch {
    // Firebase not configured in this build.
    return null;
  }
}

export async function registerPushToken() {
  const user = useAuth.getState().user;
  if (!user || Platform.OS !== 'android') return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    token ??= await deviceToken();
    if (!token) return;
    const key = `${user.id}:${token}`;
    if (registeredFor === key) return;
    await push.register(token, 'android', 'fcm');
    registeredFor = key;
  } catch {
    // Offline: retried on the next foreground.
  }
}

async function unregisterPushToken() {
  const t = token;
  registeredFor = null;
  if (!t) return;
  // Never hold up sign-out for long when offline.
  await Promise.race([push.unregister(t).catch(() => {}), new Promise((r) => setTimeout(r, 3_000))]);
}

let started = false;

/** Call once after stores hydrate. */
export function startPush() {
  if (started || Platform.OS === 'web') return;
  started = true;
  onBeforeSignOut(unregisterPushToken);
  void registerPushToken();
  useAuth.subscribe((s, prev) => {
    if (s.user && s.user.id !== prev.user?.id) void registerPushToken();
  });
  // Permission may have been granted since (e.g. from Notifications settings).
  AppState.addEventListener('change', (st) => st === 'active' && void registerPushToken());
  Notifications.addPushTokenListener((t) => {
    if (typeof t.data !== 'string') return;
    token = t.data;
    registeredFor = null;
    void registerPushToken();
  });
  // A nudge arriving while the app is open refreshes the inbox (which shows a toast).
  Notifications.addNotificationReceivedListener((n) => {
    if (isSocialNotification(socialData(n.request))) void refreshSocial();
  });
}

/** Tapping a social notification (warm or cold start) opens Activity. Mount in the root shell. */
export function useSocialNotificationResponse() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (r: Notifications.NotificationResponse | null) => {
      if (!r || !isSocialNotification(socialData(r.notification.request))) return;
      if (!useAuth.getState().user) return;
      Notifications.clearLastNotificationResponse();
      void refreshSocial();
      router.push('/friends/inbox');
    };
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}
