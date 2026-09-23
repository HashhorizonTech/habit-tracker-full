import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { playSound } from '@/audio/sounds';
import { Icon, type IconName } from '@/components/icons/Icon';
import { useLoop } from '@/components/illustration';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Segmented } from '@/components/ui/Segmented';
import { Stepper } from '@/components/ui/Stepper';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import type { Category, Frequency, FrequencyType, TimeOfDay } from '@/data/types';
import { haptic } from '@/lib/haptics';
import { useData } from '@/store/data';
import { toast } from '@/store/ui';
import { useTheme } from '@/theme';
import { HABIT_HUES } from '@/theme/themes.generated';
import { fonts, MAX_FONT_SCALE } from '@/theme/tokens';

export type HabitPrefill = Partial<{ name: string; icon: IconName; hue: number; category: Category }>;

const ICONS: IconName[] = ['drop', 'book', 'dumbbell', 'code', 'leaf', 'pen', 'sun', 'moon', 'heart', 'coffee', 'bolt', 'music'];
const CATEGORIES: Category[] = ['Morning', 'Health', 'Fitness', 'Learning', 'Work', 'Personal', 'Evening'];
const FREQS: { value: FrequencyType; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'days', label: 'Specific days' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const UNITS = ['times', 'min', 'pages', 'glasses'];
const REMINDER_TIMES = ['7:00 AM', '8:00 AM', '12:30 PM', '6:00 PM', '9:00 PM'];
const SUGGESTIONS: { name: string; icon: IconName; hue: number }[] = [
  { name: 'Drink water', icon: 'drop', hue: 230 },
  { name: 'Read', icon: 'book', hue: 60 },
  { name: 'Stretch', icon: 'dumbbell', hue: 25 },
  { name: 'Walk outside', icon: 'sun', hue: 120 },
  { name: 'No phone in bed', icon: 'moon', hue: 285 },
];
/** Tile icon colour on the full-strength habit colour (prototype `oklch(0.2 0.03 260)`). */
const TILE_INK = '#1c1e2d';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function freqText(type: FrequencyType, days: boolean[], times: number, every: number): string {
  switch (type) {
    case 'daily':
      return 'Every day';
    case 'days':
      return DAY_SHORT.filter((_, i) => days[i]).join(' · ') || 'Pick some days';
    case 'weekly':
      return `${times} times a week`;
    case 'monthly':
      return `${times} times a month`;
    case 'custom':
      return `Every ${every} days`;
  }
}

/** "8:00 AM" → 24h hour. */
function hourOf(time: string): number {
  const [hm, ampm] = time.split(' ');
  const h = parseInt(hm, 10) % 12;
  return ampm === 'PM' ? h + 12 : h;
}

function deriveTimeOfDay(category: Category, reminderOn: boolean, time: string): TimeOfDay {
  if (category === 'Morning' || category === 'Evening') return category;
  if (!reminderOn) return 'Anytime';
  const h = hourOf(time);
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
}

/** Create habit sheet body (SPEC §4.5). The SheetHost supplies grabber, padding and scrolling. */
export function CreateHabitSheet({ close, prefill }: { close: () => void; prefill?: HabitPrefill }) {
  const { c, habit } = useTheme();
  const addHabit = useData((s) => s.addHabit);

  const [name, setName] = useState(prefill?.name ?? '');
  const [icon, setIcon] = useState<IconName>(prefill?.icon ?? 'drop');
  const [hue, setHue] = useState(prefill?.hue ?? 230);
  const [category, setCategory] = useState<Category>(prefill?.category ?? 'Health');
  const [freq, setFreq] = useState<FrequencyType>('daily');
  const [days, setDays] = useState([true, true, true, true, true, false, false]);
  const [times, setTimes] = useState(5);
  const [every, setEvery] = useState(2);
  const [goal, setGoal] = useState(1);
  const [unit, setUnit] = useState('times');
  const [reminderOn, setReminderOn] = useState(true);
  const [time, setTime] = useState('8:00 AM');
  const [notes, setNotes] = useState('');

  const h = habit(hue);
  const trimmed = name.trim();
  const inputStyle = [styles.input, { borderColor: c.line, backgroundColor: c.surface, color: c.ink }];

  const save = () => {
    if (!trimmed) return;
    const frequency: Frequency =
      freq === 'days' ? { type: freq, days } : freq === 'weekly' || freq === 'monthly' ? { type: freq, times } : freq === 'custom' ? { type: freq, every } : { type: 'daily' };
    addHabit({
      name: trimmed,
      icon,
      hue,
      category,
      frequency,
      goal,
      unit,
      step: unit === 'min' || unit === 'pages' ? 5 : 1,
      timeOfDay: deriveTimeOfDay(category, reminderOn, time),
      reminder: reminderOn ? { on: true, time } : null,
      notes: notes.trim() || null,
    });
    playSound('pop');
    haptic.success();
    close();
    toast(`Planted · ${trimmed}`, 'leaf');
  };

  return (
    <View style={styles.root}>
      <View style={styles.titleRow}>
        <Text variant="h2" style={styles.title} accessibilityRole="header">
          New habit
        </Text>
        <IconButton icon="close" label="Close" size={36} iconSize={17} variant="plain" onPress={close} style={{ backgroundColor: c.surface2 }} />
      </View>

      <View style={[styles.preview, { backgroundColor: h.soft }]} accessibilityLabel={`Preview: ${trimmed || 'New habit'}`}>
        <FloatingTile color={h.c} icon={icon} />
        <View style={styles.previewText}>
          <Text style={styles.previewName} numberOfLines={1}>
            {trimmed || 'New habit'}
          </Text>
          <Text variant="small" color="ink2" numberOfLines={2}>
            {`${freqText(freq, days, times, every)} · ${goal} ${unit} · ${category}`}
          </Text>
        </View>
      </View>

      <View style={styles.nameGroup}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="What do you want to do?"
          placeholderTextColor={c.ink3}
          accessibilityLabel="Habit name"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          returnKeyType="done"
          style={[inputStyle, styles.nameInput]}
        />
        <View style={styles.wrap6}>
          {SUGGESTIONS.map((s) => (
            <Chip
              key={s.name}
              label={s.name}
              icon={s.icon}
              variant="soft"
              size="sm"
              onPress={() => {
                haptic.selection();
                setName(s.name);
                setIcon(s.icon);
                setHue(s.hue);
              }}
            />
          ))}
        </View>
      </View>

      <Section title="Icon">
        {[ICONS.slice(0, 6), ICONS.slice(6)].map((row, r) => (
          <View key={r} style={styles.iconRow}>
            {row.map((k) => {
              const on = k === icon;
              return (
                <PressableScale
                  key={k}
                  kind="icon"
                  onPress={() => {
                    haptic.selection();
                    setIcon(k);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={k}
                  style={[styles.iconCell, { borderColor: on ? h.c : c.line, backgroundColor: on ? h.soft : 'transparent' }]}
                >
                  <Icon name={k} size={21} color={on ? h.text : c.ink2} />
                </PressableScale>
              );
            })}
          </View>
        ))}
      </Section>

      <Section title="Color">
        <View style={styles.swatches}>
          {HABIT_HUES.map((hh, i) => {
            const col = habit(hh).c;
            const on = hh === hue;
            return (
              <PressableScale
                key={hh}
                kind="icon"
                hitSlop={2}
                onPress={() => {
                  haptic.selection();
                  setHue(hh);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Colour ${i + 1}`}
                // 2px colour ring outside a 3px sheet-coloured gap.
                style={[styles.swatchRing, { borderColor: on ? col : 'transparent' }]}
              >
                <View style={[styles.swatch, { backgroundColor: col }]} />
              </PressableScale>
            );
          })}
        </View>
      </Section>

      <Section title="Category">
        <View style={styles.wrap6}>
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              selected={cat === category}
              onPress={() => {
                haptic.selection();
                setCategory(cat);
              }}
            />
          ))}
        </View>
      </Section>

      <Section title="Frequency">
        <Segmented options={FREQS} value={freq} onChange={setFreq} size="sm" scroll label="Frequency" />
        {freq === 'days' && (
          <View style={styles.days}>
            {DAY_NAMES.map((d, i) => {
              const on = days[i];
              return (
                <PressableScale
                  key={d}
                  kind="icon"
                  hitSlop={2}
                  onPress={() => {
                    haptic.selection();
                    setDays(days.map((v, j) => (j === i ? !v : v)));
                  }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={d}
                  style={[styles.day, { borderColor: on ? c.a1 : c.line, backgroundColor: on ? c.a1 : 'transparent' }]}
                >
                  <Text style={styles.dayText} color={on ? 'a1ink' : 'ink2'}>
                    {d[0]}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        )}
        {(freq === 'weekly' || freq === 'monthly') && (
          <CountRow
            label={`times per ${freq === 'monthly' ? 'month' : 'week'}`}
            value={times}
            min={1}
            max={30}
            onChange={setTimes}
          >
            Do this <Text style={styles.bold}>{`${times} times`}</Text> per {freq === 'monthly' ? 'month' : 'week'}
          </CountRow>
        )}
        {freq === 'custom' && (
          <CountRow label="days between" value={every} min={2} max={30} onChange={setEvery}>
            Every <Text style={styles.bold}>{`${every} days`}</Text>
          </CountRow>
        )}
      </Section>

      <Section title="Daily goal & duration">
        <View style={styles.goalRow}>
          <Stepper
            value={goal}
            label="daily goal"
            min={1}
            max={99}
            onDec={() => setGoal((g) => clamp(g - 1, 1, 99))}
            onInc={() => setGoal((g) => clamp(g + 1, 1, 99))}
          />
          {UNITS.map((u) => (
            <Chip
              key={u}
              label={u}
              selected={u === unit}
              onPress={() => {
                haptic.selection();
                setUnit(u);
              }}
            />
          ))}
        </View>
      </Section>

      <View style={[styles.reminder, { backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={styles.reminderHead}>
          <Icon name="bell" size={20} color={c.ink2} />
          <Text variant="bodyStrong" style={styles.flex}>
            Reminder
          </Text>
          <Toggle value={reminderOn} onChange={setReminderOn} label="Reminder" />
        </View>
        {reminderOn && (
          <View style={styles.wrap6}>
            {REMINDER_TIMES.map((t) => (
              <Chip
                key={t}
                label={t}
                size="sm"
                selected={t === time}
                onPress={() => {
                  haptic.selection();
                  setTime(t);
                }}
              />
            ))}
          </View>
        )}
      </View>

      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Notes — why does this matter to you?"
        placeholderTextColor={c.ink3}
        accessibilityLabel="Notes"
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        multiline
        numberOfLines={2}
        textAlignVertical="top"
        style={[inputStyle, styles.notes]}
      />

      <Button label="Plant this habit" onPress={save} disabled={!trimmed} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="caption" color="ink3" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Preview tile: full habit colour, dark icon, floating 0 → -6 → 0 over 3.5 s. */
function FloatingTile({ color, icon }: { color: string; icon: IconName }) {
  const t = useLoop(3500);
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * t.value }] }));
  return (
    <Animated.View style={[styles.tile, { backgroundColor: color }, float]}>
      <Icon name={icon} size={26} color={TILE_INK} />
    </Animated.View>
  );
}

/** "Do this N times per week" / "Every N days" card with a −/+ stepper. */
function CountRow({ children, label, value, min, max, onChange }: {
  children: ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={[styles.countRow, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={styles.flex}>{children}</Text>
      <Stepper
        value={value}
        label={label}
        min={min}
        max={max}
        onDec={() => onChange(clamp(value - 1, min, max))}
        onInc={() => onChange(clamp(value + 1, min, max))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 20 },
  flex: { flex: 1 },
  bold: { fontFamily: fonts.body700 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, lineHeight: 28, letterSpacing: -0.48 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 24 },
  previewText: { flex: 1, minWidth: 0, gap: 2 },
  previewName: { fontFamily: fonts.display700, fontSize: 18, lineHeight: 23 },
  tile: { width: 56, height: 56, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 18 },
  nameInput: { height: 54, fontFamily: fonts.body600, fontSize: 16 },
  // The prototype pulls suggestions 10px closer to the input than the section gap.
  nameGroup: { gap: 10 },
  notes: { minHeight: 72, paddingTop: 14, paddingBottom: 14, fontFamily: fonts.body400, fontSize: 15, lineHeight: 21 },
  wrap6: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  section: { gap: 10 },
  iconRow: { flexDirection: 'row', gap: 8 },
  iconCell: { flex: 1, aspectRatio: 1, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  swatches: { flexDirection: 'row', justifyContent: 'space-between' },
  swatchRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 30, height: 30, borderRadius: 15 },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontFamily: fonts.body700, fontSize: 13.5 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingRight: 8, paddingLeft: 16, borderRadius: 16, borderWidth: 1 },
  goalRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  reminder: { gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1 },
  reminderHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
