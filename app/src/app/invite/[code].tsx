import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/api/auth';
import { normalizeCode } from '@/api/social';
import { usePendingInvite } from '@/store/pendingInvite';
import { errorText, sendFriendRequest } from '@/store/social';
import { useOnboarding } from '@/store/onboarding';
import { toast } from '@/store/ui';
import { useTheme } from '@/theme';

// The same link can be delivered twice (dev double effects, initial URL + event).
let lastHandled = { code: '', at: 0 };

/**
 * Invite links: tend://invite/<CODE> and https://hashhorizon.in/app/tend/invite/<CODE>
 * (rewritten by +native-intent). Signed in → friend request; signed out → the code waits
 * in pendingInvite for sign-up (prefilled) or sign-in (sent afterwards).
 */
export default function InviteLink() {
  const { c } = useTheme();
  const { code: raw } = useLocalSearchParams<{ code: string }>();

  useEffect(() => {
    const code = normalizeCode(raw ?? '');
    const valid = code.length >= 6 && code.length <= 12;
    if (!useAuth.getState().user) {
      if (valid) usePendingInvite.getState().setCode(code);
      router.replace(useOnboarding.getState().seen ? '/sign-in' : '/onboarding');
      return;
    }
    if (!valid) {
      router.replace('/friends');
      return;
    }
    if (lastHandled.code === code && Date.now() - lastHandled.at < 10_000) {
      router.replace('/friends');
      return;
    }
    lastHandled = { code, at: Date.now() };
    sendFriendRequest(code)
      .then((req) => toast(`Friend request sent to ${req.to.name}`, 'heart'))
      .catch((e: unknown) => toast(errorText(e), 'heart'))
      .finally(() => router.replace('/friends'));
  }, [raw]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
      <ActivityIndicator color={c.a1} />
    </View>
  );
}
