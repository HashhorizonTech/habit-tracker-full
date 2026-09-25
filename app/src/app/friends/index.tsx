import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { normalizeCode, type RequestItem } from '@/api/social';
import { FriendAvatar } from '@/components/friends/FriendAvatar';
import { FriendRow } from '@/components/friends/FriendRow';
import { InviteCard } from '@/components/friends/InviteCard';
import { Icon } from '@/components/icons/Icon';
import { Mascot } from '@/components/illustration';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { haptic } from '@/lib/haptics';
import {
  acceptRequest, cancelRequest, declineRequest, errorText, refreshSocial, sendFriendRequest, useSocial, useSocialPolling,
} from '@/store/social';
import { toast } from '@/store/ui';
import { useTheme } from '@/theme';
import { fonts, MAX_FONT_SCALE } from '@/theme/tokens';

const MAX_WIDTH = 640;

/** Header bell → Activity, with the unread count. */
function InboxBell() {
  const { c } = useTheme();
  const unread = useSocial((s) => s.unreadCount);
  return (
    <View>
      <IconButton icon="bell" label={unread ? `Activity, ${unread} new` : 'Activity'} onPress={() => router.push('/friends/inbox')} />
      {unread > 0 && (
        <View pointerEvents="none" style={[styles.badge, { backgroundColor: c.a1, borderColor: c.bg }]}>
          <Text style={{ fontFamily: fonts.body700, fontSize: 11, lineHeight: 14, color: c.a1ink }} maxFontSizeMultiplier={1}>
            {unread > 9 ? '9+' : unread}
          </Text>
        </View>
      )}
    </View>
  );
}

function AddByCode() {
  const { c } = useTheme();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = normalizeCode(code).length === 8;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const req = await sendFriendRequest(code);
      setCode('');
      haptic.success();
      toast(`Friend request sent to ${req.to.name}`, 'heart');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      <Text variant="caption" color="ink3" accessibilityRole="header">Add by code</Text>
      <View style={styles.addRow}>
        <View style={[styles.input, { backgroundColor: c.surface, borderColor: c.line }]}>
          <TextInput
            value={code}
            onChangeText={(t) => {
              setCode(t.toUpperCase().slice(0, 12));
              setError(null);
            }}
            placeholder="K7PQ-2MXR"
            placeholderTextColor={c.ink3}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="send"
            onSubmitEditing={submit}
            accessibilityLabel="Friend's invite code"
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={{ flex: 1, height: '100%', color: c.ink, fontFamily: fonts.body700, fontSize: 16, letterSpacing: 1 }}
          />
        </View>
        <Button label="Add" size="md" onPress={submit} disabled={!valid} loading={busy} style={{ paddingHorizontal: 20 }} />
      </View>
      {error && <Text variant="small" color="ink2" accessibilityLiveRegion="polite">{error}</Text>}
    </View>
  );
}

function IncomingRow({ req, last }: { req: RequestItem; last?: boolean }) {
  const { c } = useTheme();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const act = async (kind: 'accept' | 'decline') => {
    setBusy(kind);
    try {
      if (kind === 'accept') {
        await acceptRequest(req.id);
        haptic.success();
        toast(`You and ${req.from.name} are friends now`, 'heart');
      } else await declineRequest(req.id);
    } catch (e) {
      toast(errorText(e), 'cloud');
      setBusy(null);
    }
  };
  return (
    <View style={[styles.reqRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }]}>
      <FriendAvatar name={req.from.name} initial={req.from.initial} size={40} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>{req.from.name}</Text>
        <Text variant="small" color="ink3">Wants to be friends</Text>
      </View>
      <Button label="Decline" variant="ghost" size="sm" onPress={() => act('decline')} loading={busy === 'decline'} disabled={!!busy} style={{ paddingHorizontal: 10 }} />
      <Button label="Accept" size="sm" onPress={() => act('accept')} loading={busy === 'accept'} disabled={!!busy} style={{ paddingHorizontal: 16 }} />
    </View>
  );
}

function OutgoingRow({ req }: { req: RequestItem }) {
  const { c } = useTheme();
  const [busy, setBusy] = useState(false);
  const cancel = async () => {
    setBusy(true);
    try {
      await cancelRequest(req.id);
    } catch (e) {
      toast(errorText(e), 'cloud');
      setBusy(false);
    }
  };
  return (
    <View style={styles.outRow}>
      <Icon name="clock" size={16} color={c.ink3} />
      <Text variant="small" color="ink2" style={{ flex: 1 }} numberOfLines={1}>
        Waiting on {req.to.name}
      </Text>
      <PressableScale onPress={cancel} disabled={busy} hitSlop={10} accessibilityLabel={`Cancel request to ${req.to.name}`}>
        <Text style={{ fontFamily: fonts.body700, fontSize: 13, opacity: busy ? 0.5 : 1 }} color="ink3">Cancel</Text>
      </PressableScale>
    </View>
  );
}

function Empty() {
  return (
    <View style={styles.empty}>
      <Mascot size={110} face="happy" accessory="sparkle" />
      <Text variant="h2" align="center">Better together</Text>
      <Text color="ink2" align="center" style={{ maxWidth: 320 }}>
        Invite a friend to see each other’s streaks and cheer each other on.
      </Text>
    </View>
  );
}

/** Friends (v1.2): invite, add by code, requests and the friends list. */
export default function FriendsScreen() {
  const { c } = useTheme();
  const me = useSocial((s) => s.me);
  const friends = useSocial((s) => s.friends);
  const incoming = useSocial((s) => s.incoming);
  const outgoing = useSocial((s) => s.outgoing);
  const loaded = useSocial((s) => s.loadedAt != null);
  const [pulling, setPulling] = useState(false);
  useSocialPolling();

  const onRefresh = async () => {
    setPulling(true);
    await refreshSocial();
    setPulling(false);
  };

  return (
    <Screen contentStyle={{ maxWidth: MAX_WIDTH + 64, gap: 24 }} refreshControl={<RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={c.ink3} colors={[c.a1]} />}>
      <View style={{ marginBottom: -4 }}>
        <ScreenHeader
          title="Friends"
          back
          right={
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <IconButton icon="eye" label="What friends see" onPress={() => router.push('/friends/sharing')} />
              <InboxBell />
            </View>
          }
        />
      </View>

      <InviteCard me={me} />
      <AddByCode />

      {incoming.length > 0 && (
        <View style={{ gap: 10 }}>
          <Text variant="caption" color="ink3" accessibilityRole="header">Requests</Text>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
            {incoming.map((r, i) => <IncomingRow key={r.id} req={r} last={i === incoming.length - 1} />)}
          </View>
        </View>
      )}

      {friends.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Text variant="caption" color="ink3" accessibilityRole="header">
            {friends.length} {friends.length === 1 ? 'friend' : 'friends'}
          </Text>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
            {friends.map((f, i) => (
              <FriendRow
                key={f.userId}
                friend={f}
                last={i === friends.length - 1}
                onPress={() => router.push({ pathname: '/friends/[id]', params: { id: f.userId } })}
              />
            ))}
          </View>
        </View>
      ) : (
        (loaded || me) && incoming.length === 0 && <Empty />
      )}

      {outgoing.length > 0 && (
        <View style={{ gap: 4 }}>
          <Text variant="caption" color="ink3" accessibilityRole="header">Sent</Text>
          {outgoing.map((r) => <OutgoingRow key={r.id} req={r} />)}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, height: 48, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  card: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  outRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, opacity: 0.85 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 12 },
});
