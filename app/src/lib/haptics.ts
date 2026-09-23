import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { usePrefs } from '@/store/prefs';

const enabled = () => Platform.OS !== 'web' && usePrefs.getState().haptics;

/** Haptic feedback that respects the Settings toggle. Failures are ignored. */
export const haptic = {
  light: () => enabled() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  medium: () => enabled() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  selection: () => enabled() && Haptics.selectionAsync().catch(() => {}),
  success: () => enabled() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
};
