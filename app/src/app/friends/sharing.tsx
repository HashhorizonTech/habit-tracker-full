import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { social } from '@/api/social';
import { FriendAvatar } from '@/components/friends/FriendAvatar';
import { HabitTile } from '@/components/habit/HabitTile';
import { SettingsGroup, SettingsRow } from '@/components/settings';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { liveHabits } from '@/data/selectors';
import { publishFriendCard } from '@/lib/friendCard';
import { useData } from '@/store/data';
import { errorText, unblockUser, useSocial } from '@/store/social';
import { useSocialPrefs } from '@/store/socialPrefs';
import { toast } from '@/store/ui';

const MAX_WIDTH = 640;

function BlockedRow({ userId, name }: { userId: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const unblock = async () => {
    setBusy(true);
    try {
      await unblockUser(userId);
      toast(`${name} is unblocked`, 'check');
    } catch (e) {
      toast(errorText(e), 'cloud');
      setBusy(false);
    }
  };
  return (
    <SettingsRow
      title={name}
      leading={<FriendAvatar name={name} size={38} />}
      right={<Button label="Unblock" size="sm" variant="secondary" onPress={unblock} loading={busy} style={{ paddingHorizontal: 14 }} />}
    />
  );
}

/** What friends see: habit-name sharing and blocked people. */
export default function SharingScreen() {
  const habitsMap = useData((s) => s.habits);
  const habits = useMemo(() => liveHabits(habitsMap), [habitsMap]);
  const shareNames = useSocialPrefs((s) => s.shareHabitNames);
  const sharedIds = useSocialPrefs((s) => s.sharedHabitIds);
  const setShareNames = useSocialPrefs((s) => s.setShareHabitNames);
  const setHabitShared = useSocialPrefs((s) => s.setHabitShared);
  const blocked = useSocial((s) => s.blocked);
  const shared = new Set(sharedIds);

  useEffect(() => {
    void useSocial.getState().refreshBlocked();
  }, []);

  const toggleMaster = (on: boolean) => {
    setShareNames(on);
    social.updateSettings({ shareHabitNames: on }).catch(() => {});
    // Turning sharing off should take effect right away.
    if (!on) void publishFriendCard(true);
  };

  return (
    <Screen contentStyle={{ maxWidth: MAX_WIDTH + 64, gap: 24 }}>
      <View style={{ marginBottom: -4 }}>
        <ScreenHeader title="What friends see" back />
      </View>
      <Text color="ink2">
        Friends always see your streak, today’s progress, level and badges. Mood and notes are never shared.
      </Text>

      <SettingsGroup title="Habits">
        <SettingsRow
          title="Share habit names"
          sub="Pick which habits friends can see, with today’s check and streak."
          icon="eye"
          toggle={{ value: shareNames, onChange: toggleMaster }}
        />
        {shareNames &&
          habits.map((h) => (
            <SettingsRow
              key={h.id}
              title={h.name}
              leading={<HabitTile hue={h.hue} icon={h.icon} size={38} />}
              toggle={{ value: shared.has(h.id), onChange: (on) => setHabitShared(h.id, on) }}
            />
          ))}
      </SettingsGroup>
      {shareNames && habits.length === 0 && <Text variant="small" color="ink3">Your habits will show up here once you add some.</Text>}

      <SettingsGroup title="Blocked">
        {blocked.length === 0 ? (
          <View style={styles.none}>
            <Text variant="small" color="ink3">No one is blocked.</Text>
          </View>
        ) : (
          blocked.map((b) => <BlockedRow key={b.userId} userId={b.userId} name={b.name} />)
        )}
      </SettingsGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  none: { paddingVertical: 16, paddingHorizontal: 16 },
});
