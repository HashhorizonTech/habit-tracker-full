// Preset goals: check the ready-made habits that fit, add them in one go.
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { playSound } from '@/audio/sounds';
import { PresetRow } from '@/components/habit/PresetRow';
import { Icon } from '@/components/icons/Icon';
import { PlusPill } from '@/components/plus/PlusPill';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { goBack, ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { nameKey, PRESET_SECTIONS, PRESETS, presetToHabit } from '@/data/presets';
import { liveHabits } from '@/data/selectors';
import { openCreateHabit } from '@/lib/actions';
import { haptic } from '@/lib/haptics';
import { FREE_HABIT_LIMIT, openPaywall } from '@/lib/plusFeatures';
import { useData } from '@/store/data';
import { usePlus } from '@/store/plus';
import { toast } from '@/store/ui';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

const goals = (n: number) => `${n} ${n === 1 ? 'goal' : 'goals'}`;

export default function PresetsScreen() {
  const { c } = useTheme();
  const habitsMap = useData((s) => s.habits);
  const addHabit = useData((s) => s.addHabit);
  const { active: plus } = usePlus();
  const [selected, setSelected] = useState<string[]>([]);

  const live = useMemo(() => liveHabits(habitsMap), [habitsMap]);
  const taken = useMemo(() => new Set(live.map((h) => nameKey(h.name))), [live]);
  const addable = PRESETS.filter((p) => !taken.has(nameKey(p.name))).length;

  // Free keeps every habit it has; it just can't plant past the limit.
  const room = plus ? Infinity : Math.max(0, FREE_HABIT_LIMIT - live.length);
  const full = selected.length >= room;
  const left = room - selected.length;
  const showLimit = !plus && room < addable;

  const toggle = useCallback(
    (id: string) => {
      if (selected.includes(id)) {
        haptic.selection();
        setSelected(selected.filter((s) => s !== id));
        return;
      }
      if (selected.length >= room) {
        openPaywall('habits');
        return;
      }
      haptic.selection();
      setSelected([...selected, id]);
    },
    [selected, room],
  );

  const add = () => {
    const picks = PRESETS.filter((p) => selected.includes(p.id) && !taken.has(nameKey(p.name)));
    if (!picks.length) return;
    for (const p of picks) addHabit(presetToHabit(p));
    playSound('complete');
    haptic.success();
    toast(`Added ${goals(picks.length)}`, 'leaf');
    goBack();
  };

  const createOwn = () => {
    goBack();
    openCreateHabit();
  };

  return (
    <Screen
      footer={
        <Button
          label={selected.length ? `Add ${goals(selected.length)}` : 'Add goals'}
          onPress={add}
          disabled={!selected.length}
        />
      }
    >
      <ScreenHeader
        title="Pick the goals you want."
        subtitle={`${selected.length} selected. Check any that fit, uncheck any that don’t.`}
        back
      />
      <View style={styles.body}>
        {showLimit && (
          <PressableScale
            onPress={() => openPaywall('habits')}
            scaleTo={0.98}
            accessibilityLabel={limitText(left)}
            accessibilityHint="Opens Plus"
            style={[styles.limit, { backgroundColor: c.a1soft }]}
          >
            <Text variant="bodyStrong" style={styles.flex} accessibilityLiveRegion="polite">
              {limitText(left)}
            </Text>
            <PlusPill />
          </PressableScale>
        )}

        {PRESET_SECTIONS.map((section) => (
          <View key={section} style={styles.section}>
            <Text variant="caption" color="ink3" accessibilityRole="header">
              {section}
            </Text>
            {PRESETS.filter((p) => p.section === section).map((p) => (
              <PresetRow
                key={p.id}
                preset={p}
                on={selected.includes(p.id)}
                added={taken.has(nameKey(p.name))}
                full={full}
                fullHint="No room left on Free. Opens Plus."
                onPress={toggle}
              />
            ))}
          </View>
        ))}

        <PressableScale onPress={createOwn} hitSlop={8} accessibilityLabel="Create your own" style={styles.own}>
          <Icon name="plus" size={18} color={c.a1text} strokeWidth={2.4} />
          <Text style={styles.ownText} color="a1text">
            Create your own
          </Text>
        </PressableScale>
      </View>
    </Screen>
  );
}

function limitText(left: number) {
  return left > 0
    ? `Free has room for ${FREE_HABIT_LIMIT} habits — ${left} more ${left === 1 ? 'fits' : 'fit'}.`
    : `Free has room for ${FREE_HABIT_LIMIT} habits. Plus makes room for more.`;
}

const styles = StyleSheet.create({
  body: { gap: 22 },
  flex: { flex: 1 },
  limit: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20 },
  section: { gap: 10 },
  own: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, alignSelf: 'center', paddingHorizontal: 12 },
  ownText: { fontFamily: fonts.body700, fontSize: 15 },
});
