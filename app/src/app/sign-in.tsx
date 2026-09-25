import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { authMessage, useAuth } from '@/api/auth';
import { formatCode, normalizeCode } from '@/api/social';
import { Icon } from '@/components/icons/Icon';
import { Mascot } from '@/components/illustration';
import { LogoMark } from '@/components/nav/Logo';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { playSound } from '@/audio/sounds';
import { haptic } from '@/lib/haptics';
import { usePendingInvite } from '@/store/pendingInvite';
import { refreshPlus } from '@/store/plus';
import { toast } from '@/store/ui';
import { useTheme } from '@/theme';
import { fonts, space } from '@/theme/tokens';

/** Sign in / Create account (approved addition: email + password accounts). */
export default function SignIn() {
  const { c } = useTheme();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('up');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Typed value wins; until then show a code picked up from an invite link.
  const pending = usePendingInvite((s) => s.code);
  const [typedInvite, setInvite] = useState<string | null>(null);
  const invite = typedInvite ?? (pending ? formatCode(pending) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);

  const up = mode === 'up';
  const valid = /\S+@\S+\.\S+/.test(email.trim()) && password.length >= 8 && (!up || name.trim().length > 0);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (up) {
        const code = normalizeCode(invite);
        // The field is the source of truth; a used code must not also become a friend request.
        setInvite(invite);
        usePendingInvite.getState().clear();
        const r = await signUp(name.trim(), email.trim(), password, code || undefined);
        if (r.inviteReward) {
          toast('You and your friend got 7 days of Plus 🎉', 'sparkle');
          void refreshPlus();
        }
      } else await signIn(email.trim(), password);
      playSound('complete');
      haptic.success();
    } catch (e) {
      setError(authMessage(e));
      haptic.medium();
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={{ maxWidth: 480, flexGrow: 1, justifyContent: 'center' }}>
        <View style={styles.hero}>
          <LogoMark size={30} />
          <Mascot size={120} face="happy" accessory="sun" />
        </View>
        <Text variant="display" style={{ fontSize: 38, lineHeight: 42 }} accessibilityRole="header">
          {up ? 'Plant your account.' : 'Welcome back.'}
        </Text>
        <Text color="ink2" style={{ marginTop: 8, marginBottom: 26 }}>
          {up ? 'Your habits stay on this phone and quietly back up, so nothing is ever lost.' : 'Pick up right where you left off.'}
        </Text>

        <View style={{ gap: space[3] }}>
          {up && (
            <TextField label="Your name" placeholder="Your name" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} />
          )}
          <TextField
            ref={emailRef}
            label="Email"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passRef.current?.focus()}
          />
          <TextField
            ref={passRef}
            label="Password"
            placeholder={up ? 'Password (8+ characters)' : 'Password'}
            value={password}
            onChangeText={setPassword}
            secret
            autoComplete={up ? 'new-password' : 'current-password'}
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          {up && (
            <TextField
              label="Invite code (optional)"
              placeholder="Invite code (optional)"
              value={invite}
              onChangeText={(t) => setInvite(t.toUpperCase().slice(0, 12))}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
            />
          )}
          {error && (
            <View style={[styles.error, { backgroundColor: c.surface2 }]} accessibilityLiveRegion="polite">
              <Icon name="cloud" size={18} color={c.ink2} />
              <Text variant="small" color="ink2" style={{ flex: 1 }}>{error}</Text>
            </View>
          )}
          <Button label={up ? 'Create account' : 'Sign in'} onPress={submit} disabled={!valid} loading={busy} style={{ marginTop: 6 }} />
          <PressableScale
            onPress={() => {
              setMode(up ? 'in' : 'up');
              setError(null);
            }}
            style={styles.switch}
            accessibilityLabel={up ? 'Already have an account? Sign in' : 'New here? Create an account'}
          >
            <Text variant="small" color="ink2">
              {up ? 'Already have an account? ' : 'New here? '}
              <Text style={{ fontFamily: fonts.body700, fontSize: 13 }} color="a1text">{up ? 'Sign in' : 'Create an account'}</Text>
            </Text>
          </PressableScale>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  error: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 14 },
  switch: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 8 },
});
