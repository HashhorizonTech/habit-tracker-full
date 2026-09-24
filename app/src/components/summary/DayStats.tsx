import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Flame, MoodFace, moodById } from '@/components/illustration';
import { Ring } from '@/components/ui/Ring';
import { Text } from '@/components/ui/Text';
import { formatMinutes } from '@/data/dates';
import type { DaySummary } from '@/data/summary';
import { useTheme } from '@/theme';
import { fonts, space } from '@/theme/tokens';

const RING = 104;

/** One stat line: optional glyph, muted text with bold spans. */
function Line({ lead, children }: { lead?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.line}>
      {lead}
      <Text color="ink2" style={styles.flex}>
        {children}
      </Text>
    </View>
  );
}

const B = ({ children }: { children: string }) => <Text style={styles.bold}>{children}</Text>;

/** Conic day ring plus the streak / habits / focus / mood lines. */
export function DayStats({ s }: { s: DaySummary }) {
  const { c } = useTheme();
  const mood = s.mood ? moodById(s.mood) : null;
  return (
    <View style={styles.row}>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={`${s.percent}% of today complete`} style={styles.ring}>
        <Ring size={RING} stroke={10} progress={s.percent / 100} color={c.a1} />
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.center}>
            <Text variant="h1" tabular style={styles.pct}>{`${s.percent}%`}</Text>
          </View>
        </View>
      </View>
      <View style={styles.lines}>
        <Line lead={<Flame size={17} />}>
          <B>{`${s.streak}-day streak`}</B>
        </Line>
        <Line>
          <B>{`${s.habitsDone} / ${s.habitsTotal}`}</B> habits
        </Line>
        <Line>
          <B>{`${s.focusSessions} ${s.focusSessions === 1 ? 'session' : 'sessions'}`}</B>
          {` · ${formatMinutes(s.focusMinutes)} focused`}
        </Line>
        {mood && (
          <Line lead={<MoodFace mood={mood.id} size={22} />}>
            Mood <B>{mood.label}</B>
          </Line>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: space[5] },
  ring: { width: RING, height: RING },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pct: { fontFamily: fonts.display700 },
  lines: { flex: 1, gap: 9 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  flex: { flexShrink: 1 },
  bold: { fontFamily: fonts.body700 },
});
