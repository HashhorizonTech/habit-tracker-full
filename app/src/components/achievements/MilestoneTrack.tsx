import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

const SMALL = 30;
const BIG = 40;

/** Levels L-2 … L+2 on a hairline: past filled a1, current larger in ink, future outlined. */
export function MilestoneTrack({ level }: { level: number }) {
  const { c } = useTheme();
  const first = Math.max(1, level - 2);
  const levels = Array.from({ length: 5 }, (_, i) => first + i);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Level track, ${levels[0]} to ${levels[4]}. You're on level ${level}.`}
    >
      {levels.map((l, i) => {
        const past = l < level;
        const current = l === level;
        const sz = current ? BIG : SMALL;
        return (
          <Fragment key={l}>
            {i > 0 && <View style={[styles.line, { backgroundColor: c.line }]} />}
            <View
              style={[
                styles.dot,
                {
                  width: sz,
                  height: sz,
                  borderRadius: sz / 2,
                  backgroundColor: past ? c.a1 : current ? c.ink : 'transparent',
                  borderColor: past || current ? 'transparent' : c.line,
                },
              ]}
            >
              <Text style={styles.num} color={past ? 'a1ink' : current ? 'bg' : 'ink3'} tabular>
                {l}
              </Text>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  line: { flex: 1, height: 2, marginHorizontal: 5 },
  dot: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  num: { fontFamily: fonts.display700, fontSize: 13, lineHeight: 16 },
});
