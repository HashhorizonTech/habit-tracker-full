import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { MODE_OPTIONS, ThemeTile } from '@/components/settings';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Segmented } from '@/components/ui/Segmented';
import { haptic } from '@/lib/haptics';
import { isThemeLocked, openPaywall } from '@/lib/plusFeatures';
import { useResponsive } from '@/lib/responsive';
import { useAppearance } from '@/store/appearance';
import { isPlusNow, usePlus } from '@/store/plus';
import { THEME_IDS, useTheme } from '@/theme';
import type { ThemeId } from '@/theme/palette';

const MAX_WIDTH = 720;
const GAP = 12;
/** CSS grid `repeat(auto-fill, minmax(150px, 1fr))`, at least 2 and at most 4 columns. */
const MIN_TILE = 150;

export default function ThemesScreen() {
  const { dark } = useTheme();
  const { contentWidth } = useResponsive();
  const mode = useAppearance((s) => s.mode);
  const setMode = useAppearance((s) => s.setMode);
  const themeId = useAppearance((s) => s.themeId);
  const setTheme = useAppearance((s) => s.setTheme);
  const [measured, setMeasured] = useState(0);
  const { active: plus } = usePlus();

  const width = measured || Math.min(MAX_WIDTH, contentWidth);
  const columns = Math.min(4, Math.max(2, Math.floor((width + GAP) / (MIN_TILE + GAP))));
  const tileWidth = Math.floor((width - GAP * (columns - 1)) / columns);

  const onSelect = useCallback(
    (id: ThemeId) => {
      if (id === useAppearance.getState().themeId) return;
      // Locked themes open Plus and never switch the theme.
      if (isThemeLocked(id, isPlusNow())) {
        openPaywall('themes');
        return;
      }
      haptic.selection();
      setTheme(id);
    },
    [setTheme],
  );

  return (
    <Screen>
      <ScreenHeader title="Themes" subtitle="Same app, different mood." back />
      <View style={styles.body}>
        <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} size="sm" label="Appearance mode" />
        <View
          style={styles.grid}
          onLayout={(e) => setMeasured(Math.floor(e.nativeEvent.layout.width))}
          accessibilityRole="radiogroup"
          accessibilityLabel="Color theme"
        >
          {THEME_IDS.map((id) => (
            <ThemeTile key={id} id={id} dark={dark} selected={id === themeId} onSelect={onSelect} width={tileWidth} locked={isThemeLocked(id, plus)} />
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 20, width: '100%', maxWidth: MAX_WIDTH },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
});
