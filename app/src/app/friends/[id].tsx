import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { social, type Friend } from '@/api/social';
import { BadgeCoin } from '@/components/achievements/BadgeCoin';
import { FriendAvatar } from '@/components/friends/FriendAvatar';
import { friendToday, todayLabel } from '@/components/friends/FriendRow';
import { CheerSheet, ConfirmSheet, ReportSheet } from '@/components/friends/sheets';
import { HabitTile } from '@/components/habit/HabitTile';
import { Icon } from '@/components/icons/Icon';
import { ICON_PATHS, type IconName } from '@/components/icons/paths';
import { Flame } from '@/components/illustration';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Ring } from '@/components/ui/Ring';
import { Screen } from '@/components/ui/Screen';
import { goBack, ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { badgeById } from '@/lib/badges';
import { haptic } from '@/lib/haptics';
import { levelInfo } from '@/lib/xp';
import { blockUser, cheerFriend, errorText, nudgeFriend, removeFriend, useSocial, useSocialPolling } from '@/store/social';
import { toast, useUI } from '@/store/ui';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

const MAX_WIDTH = 640;

const iconOf = (name: string): IconName => (name in ICON_PATHS ? (name as IconName) : 'sparkle');

function MenuSheet({ friend }: { friend: Friend }) {
  const { c, fixed } = useTheme();
  // Opening a new sheet replaces this one in place.
  const next = useUI((s) => s.openSheet);
  const name = friend.name;
  const items: { icon: IconName; label: string; danger?: boolean; onPress: () => void }[] = [
    {
      icon: 'userMinus',
      label: 'Remove friend',
      onPress: () =>
        next(
          (done) => (
            <ConfirmSheet
              title={`Remove ${name}?`}
              body="You’ll stop seeing each other’s streaks. You can always add each other again with a code."
              confirm="Remove friend"
              onConfirm={async () => {
                await removeFriend(friend.userId);
                toast(`${name} removed`, 'check');
                goBack();
              }}
              close={done}
            />
          ),
          'Remove friend',
        ),
    },
    {
      icon: 'shield',
      label: 'Block',
      danger: true,
      onPress: () =>
        next(
          (done) => (
            <ConfirmSheet
              title={`Block ${name}?`}
              body={`${name} won’t see you, your streak or your progress, and can’t send you requests, nudges or cheers. We won’t tell them.`}
              confirm="Block"
              onConfirm={async () => {
                await blockUser(friend.userId);
                toast(`${name} is blocked`, 'shield');
                goBack();
              }}
              close={done}
            />
          ),
          'Block',
        ),
    },
    {
      icon: 'flag',
      label: 'Report',
      danger: true,
      onPress: () =>
        next(
          (done) => (
            <ReportSheet
              name={name}
              onSend={async (reason, details) => {
                try {
                  await social.report(friend.userId, reason, details);
                } catch (e) {
                  throw new Error(errorText(e));
                }
              }}
              close={done}
            />
          ),
          'Report',
        ),
    },
  ];
  return (
    <View style={{ gap: 6 }}>
      <Text variant="h2" style={{ marginBottom: 6 }}>{name}</Text>
      {items.map((it) => (
        <PressableScale key={it.label} onPress={it.onPress} scaleTo={0.98} accessibilityLabel={it.label} style={[styles.menuRow, { backgroundColor: c.surface2 }]}>
          <Icon name={it.icon} size={20} color={it.danger ? fixed.priority.high : c.ink2} />
          <Text style={{ flex: 1, fontFamily: fonts.body600, fontSize: 15, color: it.danger ? fixed.priority.high : c.ink }}>{it.label}</Text>
        </PressableScale>
      ))}
    </View>
  );
}

function Actions({ friend }: { friend: Friend }) {
  const openSheet = useUI((s) => s.openSheet);
  const [busy, setBusy] = useState(false);
  const nudge = async () => {
    setBusy(true);
    try {
      await nudgeFriend(friend.userId);
      haptic.success();
      toast('Nudge sent 🌱', 'leaf');
    } catch (e) {
      toast(errorText(e), 'leaf');
    } finally {
      setBusy(false);
    }
  };
  const cheer = () =>
    openSheet(
      (close) => (
        <CheerSheet
          name={friend.name}
          close={close}
          onSend={async (key) => {
            await cheerFriend(friend.userId, key);
            haptic.success();
            toast('Cheer sent', 'heart');
          }}
        />
      ),
      `Cheer ${friend.name} on`,
    );
  return (
    <View style={styles.actions}>
      <Button
        label={friend.nudgedToday ? 'Nudged today' : 'Nudge'}
        icon={friend.nudgedToday ? 'check' : 'leaf'}
        variant="secondary"
        size="md"
        onPress={nudge}
        disabled={friend.nudgedToday}
        loading={busy}
        style={{ flex: 1 }}
        accessibilityHint="Sends a gentle check-in, once a day"
      />
      <Button label="Cheer" icon="heart" size="md" onPress={cheer} style={{ flex: 1 }} />
    </View>
  );
}

function Profile({ friend }: { friend: Friend }) {
  const { c, fixed } = useTheme();
  const card = friend.card;
  const today = friendToday(card);
  const info = card ? levelInfo(card.xp) : null;
  const badges = (card?.badges ?? []).map(badgeById).filter((b) => b !== undefined);

  return (
    <>
      <View style={styles.hero}>
        <FriendAvatar name={friend.name} initial={friend.initial} size={96} />
        <Text style={{ fontFamily: fonts.display700, fontSize: 28, letterSpacing: -0.5 }} align="center" numberOfLines={2}>{friend.name}</Text>
        {info && card && <Text color="ink2">Level {card.level} · {info.title}</Text>}
      </View>

      {!card ? (
        <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text color="ink2" align="center">{friend.name} is just getting started. Their streak will show up here soon.</Text>
        </View>
      ) : (
        <>
          <View style={styles.stats}>
            <View
              style={[styles.panel, styles.stat, { backgroundColor: fixed.flameSoft }]}
              accessible
              accessibilityLabel={`${card.streak} day streak. Longest ${card.longestStreak} days.`}
            >
              <Flame size={30} />
              <Text style={styles.statNum} tabular>{card.streak} day streak</Text>
              <Text variant="small" color="ink2">Longest {card.longestStreak} {card.longestStreak === 1 ? 'day' : 'days'}</Text>
            </View>
            <View
              style={[styles.panel, styles.stat, { backgroundColor: c.surface, borderColor: c.line }]}
              accessible
              accessibilityLabel={`Today ${today.pct} percent. ${todayLabel(today)}.`}
            >
              <View style={styles.ring}>
                <Ring size={64} stroke={7} progress={today.pct / 100} color={c.a1} />
                <View style={StyleSheet.absoluteFill}>
                  <View style={styles.ringLabel}>
                    <Text style={{ fontFamily: fonts.display700, fontSize: 16 }} tabular>{today.pct}%</Text>
                  </View>
                </View>
              </View>
              <Text variant="small" color="ink2">{todayLabel(today)}</Text>
            </View>
          </View>

          {badges.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text variant="caption" color="ink3" accessibilityRole="header">Badges</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                {badges.map((b) => (
                  <View key={b.id} style={styles.badge} accessible accessibilityLabel={`${b.name}. ${b.desc}`}>
                    <BadgeCoin icon={b.icon} unlocked progress={1} size={56} />
                    <Text variant="small" color="ink2" align="center" numberOfLines={2}>{b.name}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ gap: 10 }}>
            <Text variant="caption" color="ink3" accessibilityRole="header">Habits</Text>
            {card.habits.length === 0 ? (
              <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.line, flexDirection: 'row', gap: 12, alignItems: 'center' }]}>
                <Icon name="lock" size={18} color={c.ink3} />
                <Text color="ink2" style={{ flex: 1 }}>{friend.name} keeps their habits private.</Text>
              </View>
            ) : (
              <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.line }]}>
                {card.habits.map((h, i) => {
                  const done = today.fresh && h.doneToday;
                  return (
                    <View
                      key={`${h.name}-${i}`}
                      style={[styles.habitRow, i < card.habits.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }]}
                      accessible
                      accessibilityLabel={`${h.name}. ${done ? 'Done today' : 'Not done yet today'}. ${h.streak} day streak.`}
                    >
                      <HabitTile hue={h.hue} icon={iconOf(h.icon)} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyStrong" numberOfLines={1}>{h.name}</Text>
                        {h.streak > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Flame size={12} animate={false} />
                            <Text variant="small" color="ink3">{h.streak} {h.streak === 1 ? 'day' : 'days'}</Text>
                          </View>
                        )}
                      </View>
                      <View style={[styles.check, done ? { backgroundColor: c.a1 } : { borderWidth: 1.5, borderColor: c.line }]}>
                        {done && <Icon name="check" size={16} color={c.a1ink} strokeWidth={2.6} />}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </>
      )}
    </>
  );
}

/** A friend's card: streak, today, badges and shared habits, with Nudge and Cheer. */
export default function FriendProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const friend = useSocial((s) => s.friends.find((f) => f.userId === id) ?? null);
  const openSheet = useUI((s) => s.openSheet);
  useSocialPolling();

  if (!friend) {
    return (
      <Screen contentStyle={{ maxWidth: MAX_WIDTH + 64 }}>
        <ScreenHeader title="Friend" back />
        <Text color="ink2">This friend isn’t on your list anymore.</Text>
        <Button label="Back to friends" size="md" variant="secondary" onPress={() => router.replace('/friends')} style={{ marginTop: 16 }} />
      </Screen>
    );
  }

  return (
    <Screen
      contentStyle={{ maxWidth: MAX_WIDTH + 64, gap: 22 }}
      footer={<Actions friend={friend} />}
    >
      <View style={styles.topBar}>
        <IconButton icon="chevLeft" label="Back" onPress={goBack} />
        <IconButton icon="more" label="More options" onPress={() => openSheet(() => <MenuSheet friend={friend} />, `Options for ${friend.name}`)} />
      </View>
      <Profile friend={friend} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 56, marginBottom: -8 },
  hero: { alignItems: 'center', gap: 8 },
  stats: { flexDirection: 'row', gap: 12 },
  panel: { borderRadius: 22, borderWidth: 1, borderColor: 'transparent', padding: 16 },
  stat: { flex: 1, alignItems: 'center', gap: 6 },
  statNum: { fontFamily: fonts.display700, fontSize: 18, lineHeight: 22, textAlign: 'center' },
  ring: { width: 64, height: 64 },
  ringLabel: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 76, alignItems: 'center', gap: 6 },
  list: { borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  check: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 12 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52, paddingHorizontal: 16, borderRadius: 16 },
});
