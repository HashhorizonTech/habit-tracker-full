import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Friend, FriendCard } from '@/api/social';
import { Icon } from '@/components/icons/Icon';
import { Flame } from '@/components/illustration';
import { PressableScale } from '@/components/ui/PressableScale';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { addDays, todayKey } from '@/data/dates';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';
import { FriendAvatar } from './FriendAvatar';

/** Today's numbers only count when the card is for (roughly) today — friends may be a time zone away. */
export function friendToday(card: FriendCard | null) {
  if (!card) return { fresh: false, done: 0, total: 0, pct: 0 };
  const today = todayKey();
  const fresh = (card.date === today || card.date === addDays(today, -1) || card.date === addDays(today, 1)) && Date.now() - card.updatedAt < 36 * 3_600_000;
  return fresh ? { fresh, done: card.todayDone, total: card.todayTotal, pct: card.todayPct } : { fresh, done: 0, total: card.todayTotal, pct: 0 };
}

export const todayLabel = (t: ReturnType<typeof friendToday>) =>
  !t.fresh ? 'Quiet today so far' : t.total ? `${t.done} of ${t.total} done` : 'Nothing planned today';

/** Friends list row: initial, name, streak, today's mini progress and level. */
export const FriendRow = memo(function FriendRow({ friend, onPress, last }: { friend: Friend; onPress: () => void; last?: boolean }) {
  const { c } = useTheme();
  const card = friend.card;
  const today = friendToday(card);
  const streak = card?.streak ?? 0;
  const label = todayLabel(today);
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      accessibilityLabel={`${friend.name}. ${streak} day streak. ${label}.${card ? ` Level ${card.level}.` : ''}`}
      style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }]}
    >
      <FriendAvatar name={friend.name} initial={friend.initial} size={46} />
      <View style={{ flex: 1, gap: 5 }}>
        <View style={styles.line}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>{friend.name}</Text>
          {streak > 0 && (
            <View style={styles.streak}>
              <Flame size={14} animate={false} />
              <Text style={styles.streakText} tabular>{streak}</Text>
            </View>
          )}
        </View>
        {card ? (
          <View style={styles.line}>
            <ProgressBar progress={today.total ? today.done / today.total : 0} color={c.a1} height={5} style={{ flex: 1, maxWidth: 120 }} />
            <Text variant="small" color="ink3" numberOfLines={1}>{label}</Text>
          </View>
        ) : (
          <Text variant="small" color="ink3">Just getting started</Text>
        )}
      </View>
      {card && (
        <View style={[styles.lv, { backgroundColor: c.surface2 }]}>
          <Text style={{ fontFamily: fonts.body700, fontSize: 12 }} color="ink2">Lv {card.level}</Text>
        </View>
      )}
      <Icon name="chev" size={18} color={c.ink3} />
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  streakText: { fontFamily: fonts.body700, fontSize: 13 },
  lv: { height: 26, paddingHorizontal: 9, borderRadius: 13, justifyContent: 'center' },
});
