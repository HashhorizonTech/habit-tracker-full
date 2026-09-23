// Step 1 review screen: tokens, type, icons, mascot and mood faces across all
// 8 themes × light/dark. Dev-only; removed from navigation in the polish pass.
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icons/Icon';
import { ICON_PATHS, type IconName } from '@/components/icons/paths';
import { Flame, Mascot, MoodFace, MOODS, type MascotAccessory, type MascotFace } from '@/components/illustration';
import { Text } from '@/components/ui/Text';
import { useAppearance } from '@/store/appearance';
import { layout, radius, space, THEME_IDS, useTheme, useThemedColor, type ColorToken } from '@/theme';
import { HABIT_HUES } from '@/theme/themes.generated';
import { getPalette } from '@/theme/palette';

const TOKENS: ColorToken[] = [
  'page', 'bg', 'bg2', 'surface', 'surface2', 'sheet', 'ink', 'ink2', 'ink3', 'line', 'track',
  'a1', 'a2', 'a1ink', 'a1text', 'a1soft', 'a2soft', 'glow',
];
const FACES: MascotFace[] = ['happy', 'wow', 'sleepy', 'focus'];
const ACCESSORIES: MascotAccessory[] = ['none', 'star', 'moon', 'sun', 'sparkle', 'coffee'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space[3], marginTop: space[8] }}>
      <Text variant="caption" color="ink3">{title}</Text>
      {children}
    </View>
  );
}

export default function DesignSystem() {
  const { c, dark, fixed, habit, name } = useTheme();
  const { themeId, mode, setTheme, setMode } = useAppearance();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pad = width >= layout.desktopBreakpoint ? layout.padDesktop : layout.padMobile;
  const bg = useThemedColor('bg');

  return (
    <Animated.View style={[{ flex: 1 }, bg]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space[6],
          paddingBottom: insets.bottom + space[10],
          paddingHorizontal: pad,
          maxWidth: layout.contentMaxWidth,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <Text variant="caption" color="ink3">Step 1 · Design system</Text>
        <Text variant="display" accessibilityRole="header">tend</Text>
        <Text color="ink2">{name} · {dark ? 'Dark' : 'Light'} — Build better days.</Text>

        <Section title="Theme">
          <View style={styles.row}>
            {THEME_IDS.map((id) => {
              const p = getPalette(id, dark).colors;
              const on = id === themeId;
              return (
                <Pressable
                  key={id}
                  onPress={() => setTheme(id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${getPalette(id, dark).name} theme`}
                  accessibilityState={{ selected: on }}
                  style={[styles.swatch, { borderColor: on ? c.ink : 'transparent' }]}
                >
                  <View style={[styles.swatchInner, { backgroundColor: p.a1 }]}>
                    <View style={{ flex: 1, backgroundColor: p.a2, transform: [{ translateX: 12 }, { rotate: '45deg' }, { scale: 1.6 }] }} />
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.segment, { backgroundColor: c.surface2 }]}>
            {(['light', 'dark', 'system'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === m }}
                style={[styles.segItem, mode === m && { backgroundColor: c.ink }]}
              >
                <Text variant="bodyStrong" color={mode === m ? 'bg' : 'ink2'}>
                  {m[0].toUpperCase() + m.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section title="Type scale">
          <Text variant="display">Display 44</Text>
          <Text variant="h1">Good morning, Ravi</Text>
          <Text variant="h2">{"Today's habits"}</Text>
          <Text variant="subhead">Subhead 17 / 600</Text>
          <Text>Body 15 — A calm place for the small things that make a big difference.</Text>
          <Text variant="caption" color="ink3">Wednesday · September 23</Text>
          <Text variant="timer">25:00</Text>
          <Text variant="bigNumber">59%</Text>
        </Section>

        <Section title="Colour tokens">
          <View style={styles.row}>
            {TOKENS.map((t) => (
              <View key={t} style={{ width: 92, gap: 4 }}>
                <View style={[styles.chip, { backgroundColor: c[t], borderColor: c.line }]} />
                <Text variant="small" color="ink2">{t}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Fixed · habit colours">
          <View style={styles.row}>
            {[fixed.flame, fixed.priority.high, fixed.priority.med, fixed.priority.low, fixed.positive].map((col, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: col }]} />
            ))}
            <Flame size={28} />
          </View>
          <View style={styles.row}>
            {HABIT_HUES.map((hue, i) => {
              const h = habit(hue);
              const icons: IconName[] = ['drop', 'book', 'dumbbell', 'code', 'leaf', 'pen', 'sun', 'moon'];
              return (
                <View key={hue} style={[styles.tile, { backgroundColor: h.soft }]}>
                  <Icon name={icons[i]} color={h.text} size={22} />
                </View>
              );
            })}
          </View>
        </Section>

        <Section title="Icons">
          <View style={styles.row}>
            {(Object.keys(ICON_PATHS) as IconName[]).map((n) => (
              <View key={n} style={[styles.iconCell, { borderColor: c.line }]} accessibilityLabel={n}>
                <Icon name={n} color={c.ink} size={22} />
              </View>
            ))}
          </View>
        </Section>

        <Section title="Mascot · faces">
          <View style={styles.row}>
            {FACES.map((f) => (
              <View key={f} style={styles.center}>
                <Mascot size={96} face={f} />
                <Text variant="small" color="ink3">{f}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Mascot · accessories">
          <View style={styles.row}>
            {ACCESSORIES.map((a) => (
              <View key={a} style={styles.center}>
                <Mascot size={96} face={a === 'moon' ? 'sleepy' : a === 'coffee' ? 'focus' : a === 'star' ? 'wow' : 'happy'} accessory={a} />
                <Text variant="small" color="ink3">{a}</Text>
              </View>
            ))}
          </View>
          <View style={styles.center}>
            <Mascot size={180} face="wow" accessory="sparkle" />
          </View>
        </Section>

        <Section title="Mood faces">
          <View style={[styles.row, { justifyContent: 'space-between', maxWidth: 360 }]}>
            {MOODS.map((m) => (
              <View key={m.id} style={styles.center}>
                <MoodFace mood={m.id} size={52} />
                <Text variant="small" color="ink3">{m.label}</Text>
              </View>
            ))}
          </View>
        </Section>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3], alignItems: 'center' },
  center: { alignItems: 'center', gap: space[1] },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, padding: 3 },
  swatchInner: { flex: 1, borderRadius: 18, overflow: 'hidden' },
  segment: { flexDirection: 'row', borderRadius: radius.md, padding: 4, maxWidth: 420 },
  segItem: { flex: 1, minHeight: layout.minTouch, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  chip: { height: 44, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth },
  dot: { width: 28, height: 28, borderRadius: 14 },
  tile: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconCell: { width: 48, height: 48, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});
