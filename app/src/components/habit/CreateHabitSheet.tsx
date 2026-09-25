import { router, type Href } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { playSound } from '@/audio/sounds';
import { Icon, type IconName } from '@/components/icons/Icon';
import { useLoop } from '@/components/illustration';
import { PlusPill } from '@/components/plus/PlusPill';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Segmented } from '@/components/ui/Segmented';
import { Stepper } from '@/components/ui/Stepper';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { presetById, type Preset, type Tracking } from '@/data/presets';
import { liveHabits } from '@/data/selectors';
import type { Category, Frequency, FrequencyType, TimeOfDay } from '@/data/types';
import { haptic } from '@/lib/haptics';
import { FREE_HABIT_LIMIT, isHabitLimitReached, openPaywall } from '@/lib/plusFeatures';
import { useData } from '@/store/data';
import { usePlus } from '@/store/plus';
import { toast } from '@/store/ui';
import { useTheme } from '@/theme';
import { HABIT_HUES } from '@/theme/themes.generated';
import { fonts, MAX_FONT_SCALE } from '@/theme/tokens';

export type HabitPrefill = Partial<{ name: string; icon: IconName; hue: number; category: Category }>;

const ICONS: IconName[] = ['drop', 'book', 'dumbbell', 'code', 'leaf', 'pen', 'sun', 'moon', 'heart', 'coffee', 'bolt', 'music'];
const CATEGORIES: Category[] = ['Morning', 'Health', 'Fitness', 'Learning', 'Work', 'Personal', 'Evening'];
const FREQS: { value: FrequencyType; label: string }[] = [
  { value: 'daily', label: 'Every day' },
  { value: 'days', label: 'Some days' },
  { value: 'weekly', label: 'Times a week' },
  { value: 'monthly', label: 'Times a month' },
  { value: 'custom', label: 'Every few days' },
];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const UNITS = ['times', 'min', 'pages', 'glasses'];
const REMINDER_TIMES = ['7:00 AM', '8:00 AM', '12:30 PM', '6:00 PM', '9:00 PM'];
/** Quick-fill chips: preset goals, so a tap sets tracking, goal and schedule too. */
const SUGGESTIONS: Preset[] = ['water', 'read', 'stretch', 'walk-outside', 'no-phone']
  .map(presetById)
  .filter((p): p is Preset => !!p);
/** Default daily goal when switching to Count it from Yes/No. */
const COUNT_DEFAULT = 5;
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
  const habitsMap = useData((s) => s.habits);
  const { active: plus } = usePlus();
  const habitCount = useMemo(() => liveHabits(habitsMap).length, [habitsMap]);
  // Free accounts keep every habit they have; they just can't plant another past the limit.
  const atLimit = isHabitLimitReached(habitCount, plus);

  const [name, setName] = useState(prefill?.name ?? '');
  const [icon, setIcon] = useState<IconName>(prefill?.icon ?? 'drop');
  const [hue, setHue] = useState(prefill?.hue ?? 230);
  const [category, setCategory] = useState<Category>(prefill?.category ?? 'Health');
  const [freq, setFreq] = useState<FrequencyType>('daily');
  const [days, setDays] = useState([true, true, true, true, true, false, false]);
  const [times, setTimes] = useState(5);
  const [every, setEvery] = useState(2);
  const [tracking, setTracking] = useState<Tracking>('check');
  const [goal, setGoal] = useState(1);
  const [unit, setUnit] = useState('times');
  // Preset chips carry their own tap size (e.g. 5 min); cleared when the unit changes by hand.
  const [presetStep, setPresetStep] = useState<number | null>(null);
  const [reminderOn, setReminderOn] = useState(true);
  const [time, setTime] = useState('8:00 AM');
  const [notes, setNotes] = useState('');

  const h = habit(hue);
  const trimmed = name.trim();
  const inputStyle = [styles.input, { borderColor: c.line, backgroundColor: c.surface, color: c.ink }];

  const unlock = () => {
    close();
    openPaywall('habits');
  };

  const chooseTracking = (t: Tracking) => {
    if (t === tracking) return;
    haptic.selection();
    setTracking(t);
    setPresetStep(null);
    if (t === 'check') {
      setGoal(1);
      setUnit('times');
    } else if (goal <= 1) {
      setGoal(COUNT_DEFAULT);
    }
  };

  const applyPreset = (p: Preset) => {
    haptic.selection();
    setName(p.name);
    setIcon(p.icon);
    setHue(p.hue);
    setCategory(p.category);
    setTracking(p.tracking);
    setGoal(p.goal);
    setUnit(p.unit);
    setPresetStep(p.step);
    setFreq(p.frequency.type);
    if (p.frequency.days) setDays([...p.frequency.days]);
    if (p.frequency.times) setTimes(p.frequency.times);
    if (p.frequency.every) setEvery(p.frequency.every);
  };

  const browsePresets = () => {
    close();
    router.push('/presets' as Href);
  };

  const count = tracking === 'count';
  const amount = count ? `${goal} ${unit}` : 'Yes/No';

  const save = () => {
    if (!trimmed || atLimit) return;
    const frequency: Frequency =
      freq === 'days' ? { type: freq, days } : freq === 'weekly' || freq === 'monthly' ? { type: freq, times } : freq === 'custom' ? { type: freq, every } : { type: 'daily' };
    addHabit({
      name: trimmed,
      icon,
      hue,
      category,
      frequency,
      goal: count ? goal : 1,
      unit,
      step: !count ? 1 : (presetStep ?? (unit === 'min' || unit === 'pages' ? 5 : 1)),
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

      {atLimit && <LimitNote onPress={unlock} />}

      <View style={[styles.preview, { backgroundColor: h.soft }]} accessibilityLabel={`Preview: ${trimmed || 'New habit'}`}>
        <FloatingTile color={h.c} icon={icon} />
        <View style={styles.previewText}>
          <Text style={styles.previewName} numberOfLines={1}>
            {trimmed || 'New habit'}
          </Text>
          <Text variant="small" color="ink2" numberOfLines={2}>
            {`${freqText(freq, days, times, every)} · ${amount}`}
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
            <Chip key={s.id} label={s.name} icon={s.icon} variant="soft" size="sm" onPress={() => applyPreset(s)} />
          ))}
        </View>
        <PressableScale
          onPress={browsePresets}
          scaleTo={0.98}
          accessibilityLabel="Browse preset goals"
          accessibilityHint="Closes this sheet and opens the preset list"
          style={[styles.browse, { backgroundColor: c.surface, borderColor: c.line }]}
        >
          <Icon name="sparkle" size={18} color={c.a1text} />
          <Text variant="bodyStrong" style={styles.flex}>
            Browse preset goals
          </Text>
          <Icon name="chev" size={18} color={c.ink3} />
        </PressableScale>
      </View>

      <Section title="How will you track it?">
        <View style={styles.trackRow} accessibilityRole="radiogroup" accessibilityLabel="How will you track it?">
          <TrackCard
            on={!count}
            title="Yes / No"
            sub="Done or not done"
            onPress={() => chooseTracking('check')}
            art={<Icon name="check" size={22} color={!count ? c.a1ink : c.ink2} strokeWidth={2.8} />}
          />
          <TrackCard
            on={count}
            title="Count it"
            sub="Glasses, pages, minutes…"
            onPress={() => chooseTracking('count')}
            art={
              <View style={styles.countArt}>
                <Icon name="stats" size={20} color={count ? c.a1ink : c.ink2} strokeWidth={2.6} />
                <Text style={styles.countNum} color={count ? 'a1ink' : 'ink2'}>
                  8
                </Text>
              </View>
            }
          />
        </View>
      </Section>

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

      {count && (
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
                  setPresetStep(null);
                }}
              />
            ))}
          </View>
        </Section>
      )}

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

      {atLimit ? (
        <Button label="Unlock unlimited habits" icon="sparkle" onPress={unlock} />
      ) : (
        <Button label="Plant this habit" onPress={save} disabled={!trimmed} />
      )}
    </View>
  );
}

/** Shown at the Free habit limit: calm, no pressure. */
function LimitNote({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      accessibilityLabel={`You’re growing ${FREE_HABIT_LIMIT} habits, the most on Free. Plus gives you room for as many as you like.`}
      accessibilityHint="Opens Plus"
      style={[styles.limit, { backgroundColor: c.a1soft }]}
    >
      <View style={styles.flex}>
        <Text variant="bodyStrong">{`You’re growing ${FREE_HABIT_LIMIT} habits — the most on Free.`}</Text>
        <Text variant="small" color="ink2">Plus gives you room for as many as you like.</Text>
      </View>
      <PlusPill />
    </PressableScale>
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

/** One of the two big "How will you track it?" choices. */
function TrackCard({ on, title, sub, art, onPress }: {
  on: boolean;
  title: string;
  sub: string;
  art: ReactNode;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.97}
      accessibilityRole="radio"
      accessibilityState={{ selected: on, checked: on }}
      accessibilityLabel={`${title}. ${sub}`}
      style={[styles.track, { backgroundColor: on ? c.a1soft : c.surface, borderColor: on ? c.a1 : c.line }]}
    >
      <View style={[styles.trackArt, { backgroundColor: on ? c.a1 : c.surface2 }]}>{art}</View>
      <View style={styles.trackText}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="small" color="ink2">
          {sub}
        </Text>
      </View>
    </PressableScale>
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
  limit: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20 },
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
  browse: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1 },
  trackRow: { flexDirection: 'row', gap: 10 },
  track: { flex: 1, gap: 12, padding: 16, borderRadius: 22, borderWidth: 1.5 },
  trackArt: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  trackText: { gap: 2 },
  countArt: { flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  countNum: { fontFamily: fonts.display800, fontSize: 13, lineHeight: 14 },
  goalRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  reminder: { gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1 },
  reminderHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
