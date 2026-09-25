import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { Share, StyleSheet, View } from 'react-native';
import { formatCode, type SocialMe } from '@/api/social';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { APP_NAME } from '@/lib/brand';
import { haptic } from '@/lib/haptics';
import { toast } from '@/store/ui';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

const INVITE_BASE = 'https://hashhorizon.in/app/tend/invite/';

export const inviteMessage = (code: string, url: string) =>
  `Let's build better days together on ${APP_NAME}. Add me with code ${formatCode(code)} or tap ${url}`;

/** "Grow together": your invite code with Share and Copy. */
export function InviteCard({ me }: { me: SocialMe | null }) {
  const { c } = useTheme();
  const code = me ? formatCode(me.inviteCode) : '····-····';
  const url = me?.inviteUrl || (me ? INVITE_BASE + me.inviteCode : '');

  const share = async () => {
    if (!me) return;
    haptic.light();
    try {
      await Share.share({ message: inviteMessage(me.inviteCode, url) });
    } catch {
      // Share sheet dismissed or unavailable.
    }
  };

  const copy = async () => {
    if (!me) return;
    await Clipboard.setStringAsync(code);
    haptic.success();
    toast('Code copied', 'copy');
  };

  const left = me?.rewardsLeft;
  return (
    <LinearGradient colors={[c.a1soft, c.a2soft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, { borderColor: c.line }]}>
      <Text variant="caption" color="ink2">Grow together</Text>
      <View style={styles.codeRow}>
        <Text
          style={[styles.code, { color: c.ink }]}
          selectable
          accessibilityLabel={me ? `Your invite code, ${code.split('').join(' ')}` : 'Loading your invite code'}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {code}
        </Text>
        <IconButton icon="copy" label="Copy invite code" onPress={copy} disabled={!me} />
      </View>
      <Button label="Share invite" icon="share" size="md" onPress={share} disabled={!me} />
      <Text variant="small" color="ink2">
        Invite a friend and you both get 7 days of Plus{left != null ? ` · ${left} left this year` : ''}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, padding: 18, gap: 12 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  code: { flex: 1, fontFamily: fonts.display800, fontSize: 34, lineHeight: 40, letterSpacing: 1.5, fontVariant: ['tabular-nums'] },
});
