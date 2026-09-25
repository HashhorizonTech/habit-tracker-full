import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import type { InboxItem } from '@/api/social';
import { FriendAvatar } from '@/components/friends/FriendAvatar';
import { Mascot } from '@/components/illustration';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { haptic } from '@/lib/haptics';
import { inboxText, relativeTime } from '@/lib/socialCopy';
import { acceptRequest, declineRequest, errorText, markAllRead, refreshSocial, useSocial, useSocialPolling } from '@/store/social';
import { toast } from '@/store/ui';
import { useTheme } from '@/theme';

const MAX_WIDTH = 640;

/** Accept / Decline inline while the request is still pending. */
function RequestActions({ item }: { item: InboxItem }) {
  const request = useSocial((s) => s.incoming.find((r) => r.from.userId === item.from.userId) ?? null);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  if (!request) return null;
  const act = async (kind: 'accept' | 'decline') => {
    setBusy(kind);
    try {
      if (kind === 'accept') {
        await acceptRequest(request.id);
        haptic.success();
        toast(`You and ${item.from.name} are friends now`, 'heart');
      } else await declineRequest(request.id);
    } catch (e) {
      toast(errorText(e), 'cloud');
      setBusy(null);
    }
  };
  return (
    <View style={styles.reqActions}>
      <Button label="Accept" size="sm" onPress={() => act('accept')} loading={busy === 'accept'} disabled={!!busy} style={{ paddingHorizontal: 16 }} />
      <Button label="Decline" size="sm" variant="ghost" onPress={() => act('decline')} loading={busy === 'decline'} disabled={!!busy} style={{ paddingHorizontal: 10 }} />
    </View>
  );
}

function Row({ item, unread, now, last }: { item: InboxItem; unread: boolean; now: number; last: boolean }) {
  const { c } = useTheme();
  const text = inboxText(item);
  const when = relativeTime(item.createdAt, now);
  return (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }]}>
      <FriendAvatar name={item.from.name} initial={item.from.initial} size={40} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text accessibilityLabel={`${unread ? 'New. ' : ''}${text}. ${when}`}>{text}</Text>
        <Text variant="small" color="ink3">{when}</Text>
        {item.kind === 'friend_request' && <RequestActions item={item} />}
      </View>
      {unread && <View style={[styles.dot, { backgroundColor: c.a1 }]} />}
    </View>
  );
}

/** Activity: nudges, cheers and friend news. Opening it marks everything read. */
export default function InboxScreen() {
  const { c } = useTheme();
  const inbox = useSocial((s) => s.inbox);
  const loaded = useSocial((s) => s.loadedAt != null);
  const [pulling, setPulling] = useState(false);
  // Snapshot of what was unread when the screen opened, so the dots stay visible this visit.
  const [session, setSession] = useState<{ unread: Set<string>; now: number }>(() => ({ unread: new Set(), now: Date.now() }));
  useSocialPolling();

  useFocusEffect(
    useCallback(() => {
      const items = useSocial.getState().inbox;
      setSession({ unread: new Set(items.filter((i) => i.readAt == null).map((i) => i.id)), now: Date.now() });
      markAllRead();
      // Items that arrive while open are read too.
      return useSocial.subscribe((s, p) => {
        if (s.unreadCount > 0 && s.inbox !== p.inbox) {
          setSession((prev) => ({ unread: new Set([...prev.unread, ...s.inbox.filter((i) => i.readAt == null).map((i) => i.id)]), now: Date.now() }));
          markAllRead();
        }
      });
    }, []),
  );

  const onRefresh = async () => {
    setPulling(true);
    await refreshSocial();
    setPulling(false);
  };

  return (
    <Screen contentStyle={{ maxWidth: MAX_WIDTH + 64 }} refreshControl={<RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={c.ink3} colors={[c.a1]} />}>
      <ScreenHeader title="Activity" back />
      {inbox.length === 0 ? (
        loaded && (
          <View style={styles.empty}>
            <Mascot size={100} face="sleepy" accessory="moon" />
            <Text variant="h2" align="center">All quiet</Text>
            <Text color="ink2" align="center" style={{ maxWidth: 300 }}>Nudges and cheers from friends will land here.</Text>
          </View>
        )
      ) : (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          {inbox.map((item, i) => (
            <Row key={item.id} item={item} unread={session.unread.has(item.id)} now={session.now} last={i === inbox.length - 1} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 7 },
  reqActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 36 },
});
