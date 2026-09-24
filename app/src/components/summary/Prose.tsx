import { StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import type { Span } from '@/data/summary';
import { fonts } from '@/theme/tokens';

/** Highlights paragraph: 16.5px prose with bold spans. */
export function Prose({ spans }: { spans: Span[] }) {
  return (
    <Text style={styles.p}>
      {spans.map((s, i) =>
        s.bold ? (
          <Text key={i} style={[styles.p, styles.b]}>
            {s.text}
          </Text>
        ) : (
          s.text
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  p: { fontFamily: fonts.body400, fontSize: 16.5, lineHeight: 25.5 },
  b: { fontFamily: fonts.body700 },
});
