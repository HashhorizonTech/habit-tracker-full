import { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

export interface HeatmapCell {
  date: string;
  /** 0 = nothing, 1–4 = increasing completion. */
  level: number;
  future: boolean;
}

export interface HeatmapProps {
  /** Week columns (Monday-first), 7 cells each — `heatmap()` from '@/data/selectors'. */
  cols: HeatmapCell[][];
  months: { col: number; label: string }[];
  /** Colours for levels 1–4 (level 0 uses `track`). */
  levels: readonly string[];
  gap?: number;
  /** Cells stop growing past this on wide layouts. */
  maxCell?: number;
  accessibilityLabel: string;
}

const LABEL_W = 30;

/** Weeks × 7 days of rounded squares (30% radius) with month labels under the columns (SPEC §4.6). */
export const Heatmap = memo(function Heatmap({ cols, months, levels, gap = 4, maxCell = 32, accessibilityLabel }: HeatmapProps) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const n = cols.length;
  const cell = n ? Math.min(maxCell, (width - gap * (n - 1)) / n) : 0;
  const step = cell + gap;
  const gridW = step * n - gap;
  const r = cell * 0.3;

  // Drop labels that would collide with the previous one; pin the last to the right edge.
  const shown: HeatmapProps['months'] = [];
  for (const m of months) {
    const prev = shown[shown.length - 1];
    if (!prev || (m.col - prev.col) * step >= LABEL_W) shown.push(m);
  }

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && cell > 0 && (
        <>
          <Svg width={gridW} height={step * 7 - gap}>
            {cols.map((col, x) =>
              col.map((d, y) => (
                <Rect
                  key={d.date}
                  x={x * step + (d.future ? 0.5 : 0)}
                  y={y * step + (d.future ? 0.5 : 0)}
                  width={d.future ? cell - 1 : cell}
                  height={d.future ? cell - 1 : cell}
                  rx={r}
                  fill={d.future ? 'none' : d.level ? levels[Math.min(4, d.level) - 1] : c.track}
                  stroke={d.future ? c.line : undefined}
                  strokeWidth={d.future ? 1 : 0}
                />
              )),
            )}
          </Svg>
          <View style={[styles.months, { width: gridW }]}>
            {shown.map((m) => {
              const left = m.col * step;
              const atEnd = left + LABEL_W > gridW;
              return (
                <Text key={`${m.col}${m.label}`} variant="small" color="ink3" style={[styles.month, atEnd ? { right: 0 } : { left }]}>
                  {m.label}
                </Text>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
});

/** "Less ■■■■ More" key: track plus three of the level colours. */
export function HeatmapLegend({ levels }: { levels: readonly string[] }) {
  const { c } = useTheme();
  const swatches = [c.track, levels[1], levels[2], levels[3]];
  return (
    <View style={styles.legend} accessible accessibilityLabel="Colour key from less to more">
      <Text variant="small" color="ink3" style={styles.legendText}>Less</Text>
      {swatches.map((s, i) => (
        <View key={i} style={[styles.swatch, { backgroundColor: s }]} />
      ))}
      <Text variant="small" color="ink3" style={styles.legendText}>More</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  months: { height: 15, marginTop: 10 },
  month: { position: 'absolute', top: 0, fontSize: 11.5, lineHeight: 15 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 11.5, lineHeight: 15, fontFamily: fonts.body500 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
});
