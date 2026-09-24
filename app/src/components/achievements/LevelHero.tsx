import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Mascot } from '@/components/illustration';
import { Text } from '@/components/ui/Text';
import { XpBar } from '@/components/ui/XpBar';
import { useSvgId } from '@/lib/useSvgId';
import { levelInfo } from '@/lib/xp';
import { splitAlpha, useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

const HALO = 130;

/** Mascot + level, title, XP bar and "x / y XP · n to Level L+1" (SPEC §4.11). */
export function LevelHero({ xp }: { xp: number }) {
  const { c } = useTheme();
  const id = useSvgId('hero');
  const info = levelInfo(xp);
  const glow = splitAlpha(c.a1soft);
  return (
    <View style={styles.row}>
      <View style={styles.halo}>
        <Svg width={HALO} height={HALO} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={id} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={glow.color} stopOpacity={glow.opacity} />
              <Stop offset="0.7" stopColor={glow.color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={HALO / 2} cy={HALO / 2} r={HALO / 2} fill={`url(#${id})`} />
        </Svg>
        <Mascot size={120} face="wow" accessory="star" />
      </View>
      <View style={styles.info}>
        <Text variant="caption" color="a1text" style={styles.caption}>
          Level {info.level}
        </Text>
        <Text variant="display" style={styles.title} accessibilityRole="header">
          {info.title}
        </Text>
        <View style={styles.bar}>
          <XpBar xp={xp} />
        </View>
        <Text variant="small" color="ink3" tabular style={styles.meta}>
          {info.into.toLocaleString()} / {info.span.toLocaleString()} XP · {info.toNext.toLocaleString()} to Level {info.level + 1}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  halo: { width: HALO, height: HALO, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, minWidth: 0, gap: 6 },
  caption: { fontFamily: fonts.body700, letterSpacing: 1.4 },
  title: { fontSize: 28, lineHeight: 30, letterSpacing: -0.56, fontFamily: fonts.display700 },
  bar: { marginTop: 4 },
  meta: { fontSize: 12.5 },
});
