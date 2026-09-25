// Sheets for the friend profile: confirm (remove / block), cheer presets and report.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CheerKey, ReportReason } from '@/api/social';
import { Icon } from '@/components/icons/Icon';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { CHEERS } from '@/lib/socialCopy';
import { errorText } from '@/store/social';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

function ErrorLine({ text }: { text: string | null }) {
  const { c } = useTheme();
  if (!text) return null;
  return (
    <View style={[styles.error, { backgroundColor: c.surface2 }]} accessibilityLiveRegion="polite">
      <Icon name="cloud" size={18} color={c.ink2} />
      <Text variant="small" color="ink2" style={{ flex: 1 }}>{text}</Text>
    </View>
  );
}

/** Title + explanation + one destructive action. The action may throw an Error with calm copy. */
export function ConfirmSheet({ title, body, confirm, onConfirm, close }: {
  title: string;
  body: string;
  confirm: string;
  onConfirm: () => Promise<void>;
  close: () => void;
}) {
  const { fixed } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      close();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 14 }}>
      <Text variant="h2">{title}</Text>
      <Text color="ink2">{body}</Text>
      <ErrorLine text={error} />
      <Button label={confirm} onPress={run} loading={busy} style={{ backgroundColor: fixed.priority.high }} />
      <Button label="Never mind" variant="ghost" size="md" onPress={close} />
    </View>
  );
}

export function CheerSheet({ name, onSend, close }: { name: string; onSend: (key: CheerKey) => Promise<void>; close: () => void }) {
  const { c } = useTheme();
  const [busy, setBusy] = useState<CheerKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const send = async (key: CheerKey) => {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      await onSend(key);
      close();
    } catch (e) {
      setError(errorText(e));
      setBusy(null);
    }
  };
  return (
    <View style={{ gap: 12 }}>
      <Text variant="h2">Cheer {name} on</Text>
      <Text color="ink2">Pick a few kind words. They’ll see it in their activity.</Text>
      {CHEERS.map((cheer) => (
        <PressableScale
          key={cheer.key}
          onPress={() => send(cheer.key)}
          disabled={!!busy}
          scaleTo={0.98}
          accessibilityLabel={`Send: ${cheer.text}`}
          style={[styles.option, { backgroundColor: c.surface2, opacity: busy && busy !== cheer.key ? 0.5 : 1 }]}
        >
          <Icon name="heart" size={20} color={c.a1text} />
          <Text style={{ flex: 1, fontFamily: fonts.body600, fontSize: 15 }}>{cheer.text}</Text>
          {busy === cheer.key && <Text variant="small" color="ink3">Sending…</Text>}
        </PressableScale>
      ))}
      <ErrorLine text={error} />
    </View>
  );
}

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'inappropriate', label: 'Inappropriate name or content' },
  { value: 'other', label: 'Something else' },
];

export function ReportSheet({ name, onSend, close }: {
  name: string;
  onSend: (reason: ReportReason, details?: string) => Promise<void>;
  close: () => void;
}) {
  const { c } = useTheme();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <View style={{ gap: 14 }}>
        <Text variant="h2">Thanks — we’ll take a look.</Text>
        <Text color="ink2">Reports are private. {name} won’t know you reported them.</Text>
        <Button label="Done" size="md" onPress={close} />
      </View>
    );
  }

  const send = async () => {
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSend(reason, details.trim() || undefined);
      setDone(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Text variant="h2">Report {name}</Text>
      <Text color="ink2">What’s going on? Reports are private.</Text>
      {REASONS.map((r) => {
        const on = reason === r.value;
        return (
          <PressableScale
            key={r.value}
            onPress={() => setReason(r.value)}
            scaleTo={0.98}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={r.label}
            style={[styles.option, { backgroundColor: on ? c.a1soft : c.surface2, borderColor: on ? c.a1 : 'transparent' }]}
          >
            <Text style={{ flex: 1, fontFamily: fonts.body600, fontSize: 15 }}>{r.label}</Text>
            {on && <Icon name="check" size={18} color={c.a1text} strokeWidth={2.4} />}
          </PressableScale>
        );
      })}
      <TextField
        label="Details (optional)"
        placeholder="Details (optional)"
        value={details}
        onChangeText={(t) => setDetails(t.slice(0, 500))}
        maxLength={500}
      />
      <ErrorLine text={error} />
      <Button label="Send report" onPress={send} disabled={!reason} loading={busy} size="md" />
    </View>
  );
}

const styles = StyleSheet.create({
  error: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 14 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1.5, borderColor: 'transparent' },
});
