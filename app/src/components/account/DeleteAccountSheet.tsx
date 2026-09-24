import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { authMessage, useAuth } from '@/api/auth';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { manageSubscription } from '@/lib/billing';
import { APP_NAME } from '@/lib/brand';
import { usePlus } from '@/store/plus';
import { toast } from '@/store/ui';
import { useTheme } from '@/theme';

/** Permanent account deletion (Google Play requires an in-app path). */
export function DeleteAccountSheet({ close }: { close: () => void }) {
  const { fixed } = useTheme();
  const deleteAccount = useAuth((s) => s.deleteAccount);
  const plus = usePlus().status;
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = confirm.trim().toUpperCase() === 'DELETE';
  const hasPlaySub = plus.active && plus.source === 'play_subscription' && plus.autoRenew;

  const run = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      close();
      toast('Your account and data were deleted.', 'trash');
    } catch (e) {
      setError(authMessage(e));
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <Text variant="h2">Delete account</Text>
      <Text color="ink2">
        This permanently deletes your {APP_NAME} account and everything in it — habits, check-ins, tasks, focus sessions,
        moods and badges — on this phone and on our servers. It can’t be undone.
      </Text>
      {hasPlaySub && (
        <View style={[styles.note, { borderColor: fixed.priority.high }]}>
          <Text variant="small" color="ink2">
            Deleting your account doesn’t cancel your Google Play subscription. Cancel it first so you’re not charged again.
          </Text>
          <Button label="Manage subscription" size="sm" variant="secondary" onPress={manageSubscription} />
        </View>
      )}
      <TextField label="Type DELETE to confirm" placeholder="Type DELETE to confirm" value={confirm} onChangeText={setConfirm} autoCapitalize="characters" />
      {error && <Text variant="small" color={fixed.priority.high}>{error}</Text>}
      <Button label="Delete my account" icon="trash" onPress={run} disabled={!ready} loading={busy} style={{ backgroundColor: fixed.priority.high }} />
      <Button label="Keep my account" variant="ghost" size="md" onPress={close} />
    </View>
  );
}

const styles = StyleSheet.create({
  note: { gap: 10, padding: 14, borderRadius: 16, borderWidth: 1 },
});
