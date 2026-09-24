// Onboarding (SPEC §4.2): five intro slides, goals, first habit. Under a minute end to end.
import { router } from 'expo-router';
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BackHandler, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { useAuth } from '@/api/auth';
import { playSound } from '@/audio/sounds';
import { HabitTile } from '@/components/habit/HabitTile';
import { Icon, type IconName } from '@/components/icons/Icon';
import { Mascot, useLinearLoop, useLoop } from '@/components/illustration';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import type { Category } from '@/data/types';
import { haptic } from '@/lib/haptics';
import { useResponsive } from '@/lib/responsive';
import { useSvgId } from '@/lib/useSvgId';
import { useData } from '@/store/data';
import { useOnboarding } from '@/store/onboarding';
import { toast } from '@/store/ui';
import { mix, splitAlpha, useTheme } from '@/theme';
import { duration, easing } from '@/theme/motion';
import { fonts } from '@/theme/tokens';

// ─── Content (prototype OB / GOALS / SUGG) ──────────────────────────────────

const OB = [
  { t: 'Build better days.', b: 'A calm place for the small things that make a big difference.' },
  { t: 'Turn small actions into lasting habits.', b: 'One tap to check in. The streaks take care of themselves.' },
  { t: 'Stay focused with Pomodoro.', b: 'Timed sessions, gentle breaks, zero noise.' },
  { t: 'See your progress grow.', b: 'Streaks, heatmaps and insights that actually mean something.' },
  { t: 'Make today count.', b: 'Let’s set you up. It takes less than a minute.' },
] as const;

type GoalId = 'Health' | 'Fitness' | 'Learning' | 'Productivity' | 'Mindfulness' | 'Personal';

const GOALS: readonly { id: GoalId; icon: IconName }[] = [
  { id: 'Health', icon: 'heart' },
  { id: 'Fitness', icon: 'dumbbell' },
  { id: 'Learning', icon: 'book' },
  { id: 'Productivity', icon: 'bolt' },
  { id: 'Mindfulness', icon: 'leaf' },
  { id: 'Personal', icon: 'sun' },
];

interface Suggestion {
  name: string;
  icon: IconName;
  hue: number;
  sub: string;
  category: Category;
  goal: number;
  unit: string;
  step: number;
}

const SUGG: Record<GoalId, Suggestion> = {
  Health: { name: 'Drink water', icon: 'drop', hue: 230, sub: '8 glasses a day', category: 'Health', goal: 8, unit: 'glasses', step: 1 },
  Fitness: { name: 'Morning stretch', icon: 'dumbbell', hue: 25, sub: '10 minutes', category: 'Fitness', goal: 10, unit: 'min', step: 5 },
  Learning: { name: 'Read', icon: 'book', hue: 60, sub: '20 pages', category: 'Learning', goal: 20, unit: 'pages', step: 5 },
  Productivity: { name: 'Plan tomorrow', icon: 'bolt', hue: 285, sub: '2 minutes each evening', category: 'Work', goal: 1, unit: 'times', step: 1 },
  Mindfulness: { name: 'Meditate', icon: 'leaf', hue: 165, sub: '10 minutes', category: 'Health', goal: 10, unit: 'min', step: 5 },
  Personal: { name: 'Journal', icon: 'pen', hue: 340, sub: 'One line a day', category: 'Personal', goal: 1, unit: 'entry', step: 1 },
};

const isGoal = (g: string): g is GoalId => Object.prototype.hasOwnProperty.call(SUGG, g);

const STEPS = 7;
const GOALS_STEP = 5;
const FIRST_STEP = 6;

/** Prototype curves. */
const DOT_EASE = Easing.bezier(0.34, 1.4, 0.5, 1);
const POP_EASE = Easing.bezier(0.3, 1.4, 0.5, 1);
const GROW_EASE = Easing.bezier(0.2, 0.9, 0.3, 1.2);
/** oklch(.2 .03 260) — the check glyph on the floating habit pills. */
const PILL_INK = '#131a26';

// ─── Motion helpers ─────────────────────────────────────────────────────────

/** Page enter: fade + 12px slide-up, 400 ms (SPEC §5). Remounted per step via `key`. */
function StepEnter({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { reduceMotion } = useTheme();
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withTiming(1, { duration: duration.pageEnter, easing: easing.out }));
  }, [t]);
  const a = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - t.value) * 12 }],
  }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** tdPop: scale .7 → 1.04 → 1 with a fade, 600 ms. */
function Pop({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { reduceMotion } = useTheme();
  const s = useSharedValue(reduceMotion ? 1 : 0.7);
  const o = useSharedValue(0);
  useEffect(() => {
    o.set(withTiming(1, { duration: 360, easing: easing.out }));
    if (!reduceMotion) {
      s.set(
        withSequence(
          withTiming(1.04, { duration: 360, easing: POP_EASE }),
          withTiming(1, { duration: 240, easing: easing.inOut }),
        ),
      );
    }
  }, [o, s, reduceMotion]);
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: s.value }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Centres a fixed-size illustration in the space left over, shrinking it on short screens. */
function Stage({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const k = box ? Math.min(1, box.width / w, box.height / h) : 1;
  return (
    <View
      style={styles.stage}
      onLayout={(e) => setBox(e.nativeEvent.layout)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {box && box.height > 40 && (
        <View style={{ width: w, height: h, transform: [{ scale: k }] }}>
          <Pop style={{ width: w, height: h }}>{children}</Pop>
        </View>
      )}
    </View>
  );
}

// ─── Progress dots ──────────────────────────────────────────────────────────

const Dot = memo(function Dot({ active, done }: { active: boolean; done: boolean }) {
  const { c, reduceMotion } = useTheme();
  const w = useSharedValue(active ? 22 : 7);
  useEffect(() => {
    const to = active ? 22 : 7;
    w.set(reduceMotion ? to : withTiming(to, { duration: 400, easing: DOT_EASE }));
  }, [active, reduceMotion, w]);
  const a = useAnimatedStyle(() => ({ width: w.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: done ? c.a1 : c.track }, a]} />;
});

function Dots({ step }: { step: number }) {
  return (
    <View
      style={styles.dots}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step + 1} of ${STEPS}`}
      accessibilityValue={{ min: 1, max: STEPS, now: step + 1 }}
    >
      {Array.from({ length: STEPS }, (_, i) => (
        <Dot key={i} active={i === step} done={i <= step} />
      ))}
    </View>
  );
}

// ─── Slide illustrations ────────────────────────────────────────────────────

function SlideSun() {
  const { c } = useTheme();
  return (
    <Stage w={280} h={280}>
      <View style={styles.center}>
        <View style={[StyleSheet.absoluteFill, styles.round, { borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.line }]} />
        <View style={[styles.round, { position: 'absolute', top: 40, left: 40, right: 40, bottom: 40, backgroundColor: c.a1soft }]} />
        <Mascot size={180} face="happy" accessory="sun" />
      </View>
    </Stage>
  );
}

function FloatPill({ label, hue, checked, delay, pos }: {
  label: string; hue: number; checked: boolean; delay: number; pos: ViewStyle;
}) {
  const { c, habit } = useTheme();
  const t = useLoop(4000, { delay });
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * t.value }] }));
  const h = habit(hue);
  return (
    <Animated.View style={[styles.pill, { backgroundColor: c.surface2, borderColor: c.line }, pos, a]}>
      {checked ? (
        <View style={[styles.pillMark, { backgroundColor: h.c }]}>
          <Icon name="check" size={14} color={PILL_INK} strokeWidth={3} />
        </View>
      ) : (
        <View style={[styles.pillMark, { borderWidth: 2, borderColor: h.c }]} />
      )}
      <Text style={styles.pillText}>{label}</Text>
    </Animated.View>
  );
}

function SlidePills() {
  return (
    <Stage w={300} h={280}>
      <View style={styles.center}>
        <Mascot size={150} face="happy" accessory="none" />
        <FloatPill label="Water" hue={230} checked delay={0} pos={{ left: 0, top: 30 }} />
        <FloatPill label="Read" hue={60} checked delay={1000} pos={{ right: 0, top: 90 }} />
        <FloatPill label="Meditate" hue={165} checked={false} delay={2000} pos={{ left: 24, bottom: 16 }} />
      </View>
    </Stage>
  );
}

function SlideFocus() {
  const { c } = useTheme();
  return (
    <Stage w={270} h={270}>
      <View style={styles.center}>
        <Svg width={270} height={270} style={StyleSheet.absoluteFill}>
          <Circle cx={135} cy={135} r={120} fill="none" stroke={c.track} strokeWidth={10} />
          <Circle
            cx={135}
            cy={135}
            r={120}
            fill="none"
            stroke={c.a1}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray="520 754"
            transform="rotate(-90 135 135)"
          />
        </Svg>
        <Mascot size={140} face="focus" accessory="coffee" />
        <View style={[styles.timeChip, { backgroundColor: c.ink }]}>
          <Text style={styles.timeChipText} color={c.bg} tabular>
            25:00
          </Text>
        </View>
      </View>
    </Stage>
  );
}

const BARS = [40, 62, 50, 78, 92];

function Bar({ pct, index, color }: { pct: number; index: number; color: string }) {
  const { reduceMotion } = useTheme();
  const g = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    g.set(withDelay(index * 90, withTiming(1, { duration: 800, easing: GROW_EASE })));
  }, [g, index, reduceMotion]);
  const a = useAnimatedStyle(() => ({ transform: [{ scaleY: g.value }] }));
  return <Animated.View style={[styles.bar, { height: `${pct}%`, backgroundColor: color }, a]} />;
}

function SlideBars() {
  const { c } = useTheme();
  const soft = mix(c.a1, c.a2, 0.45);
  return (
    <Stage w={290} h={260}>
      <View style={styles.barsStage}>
        <View style={styles.bars}>
          {BARS.map((h, i) => (
            <Bar key={i} pct={h} index={i} color={i === BARS.length - 1 ? c.a1 : soft} />
          ))}
        </View>
        <View style={{ marginBottom: 120, marginLeft: 110 }}>
          <Mascot size={110} face="wow" accessory="sparkle" />
        </View>
      </View>
    </Stage>
  );
}

const RAY_COUNT = 22;
const RAY_R = 184; // reaches the corners of the 260 box, like the CSS conic gradient
const RAYS = Array.from({ length: RAY_COUNT }, (_, i) => {
  const step = (Math.PI * 2) / RAY_COUNT;
  const a0 = i * step - Math.PI / 2;
  const a1 = a0 + step / 2;
  const p = (a: number) => `${(130 + RAY_R * Math.cos(a)).toFixed(2)} ${(130 + RAY_R * Math.sin(a)).toFixed(2)}`;
  return `M130 130 L${p(a0)} L${p(a1)} Z`;
});

function SlideRays() {
  const { c } = useTheme();
  const id = useSvgId('obRays');
  const soft = splitAlpha(c.a1soft);
  const spin = useLinearLoop(30000);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  return (
    <Stage w={280} h={280}>
      <View style={styles.center}>
        <Animated.View style={[styles.rays, a]}>
          <Svg width={260} height={260}>
            <Defs>
              {/* mask: radial-gradient(circle, black 35%, transparent 70%) */}
              <RadialGradient id={id} cx={130} cy={130} r={RAY_R} gradientUnits="userSpaceOnUse">
                <Stop offset="0.35" stopColor={soft.color} stopOpacity={soft.opacity} />
                <Stop offset="0.7" stopColor={soft.color} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <G>
              {RAYS.map((d, i) => (
                <Path key={i} d={d} fill={`url(#${id})`} />
              ))}
            </G>
          </Svg>
        </Animated.View>
        <Mascot size={180} face="wow" accessory="star" />
      </View>
    </Stage>
  );
}

const SLIDES = [SlideSun, SlidePills, SlideFocus, SlideBars, SlideRays];

// ─── Goals + first habit ────────────────────────────────────────────────────

/** The a1 check badge / radio dot that pops in with overshoot. */
function usePop(on: boolean) {
  const { reduceMotion } = useTheme();
  const v = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    const to = on ? 1 : 0;
    v.set(reduceMotion ? to : withTiming(to, { duration: 300, easing: easing.overshoot }));
  }, [on, reduceMotion, v]);
  return v;
}

const GoalCard = memo(function GoalCard({ id, icon, on, onPress }: {
  id: GoalId; icon: IconName; on: boolean; onPress: (id: GoalId) => void;
}) {
  const { c } = useTheme();
  const v = usePop(on);
  const check = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: v.value }] }));
  return (
    <PressableScale
      onPress={() => onPress(id)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={id}
      style={[styles.goal, { backgroundColor: on ? c.a1soft : c.surface, borderColor: on ? c.a1 : c.line }]}
    >
      <View style={[styles.goalIcon, { backgroundColor: c.surface2 }]}>
        <Icon name={icon} size={20} color={c.ink} />
      </View>
      <Text style={styles.goalLabel}>{id}</Text>
      <Animated.View style={[styles.goalCheck, { backgroundColor: c.a1 }, check]}>
        <Icon name="check" size={13} color={c.a1ink} strokeWidth={3.2} />
      </Animated.View>
    </PressableScale>
  );
});

const SuggestionRow = memo(function SuggestionRow({ goal, on, onPress }: {
  goal: GoalId; on: boolean; onPress: (id: GoalId) => void;
}) {
  const { c } = useTheme();
  const s = SUGG[goal];
  const v = usePop(on);
  const dot = useAnimatedStyle(() => ({ transform: [{ scale: v.value }] }));
  const bd = on ? c.a1 : c.line;
  return (
    <PressableScale
      onPress={() => onPress(goal)}
      scaleTo={0.98}
      accessibilityRole="radio"
      accessibilityState={{ selected: on, checked: on }}
      accessibilityLabel={`${s.name}, ${s.sub}`}
      style={[styles.sugg, { backgroundColor: c.surface, borderColor: bd }]}
    >
      <HabitTile hue={s.hue} icon={s.icon} size={46} />
      <View style={styles.suggText}>
        <Text style={styles.suggName} numberOfLines={1}>
          {s.name}
        </Text>
        <Text style={styles.suggSub} color="ink3" numberOfLines={1}>
          {s.sub}
        </Text>
      </View>
      <View style={[styles.radio, { borderColor: bd }]}>
        <Animated.View style={[styles.radioDot, { backgroundColor: c.a1 }, dot]} />
      </View>
    </PressableScale>
  );
});

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height, isTablet } = useResponsive();
  const glowId = useSvgId('obGlow');

  const stored = useOnboarding((s) => s.goals);
  const setGoals = useOnboarding((s) => s.setGoals);
  const goals = useMemo<GoalId[]>(() => {
    const g = stored.filter(isGoal);
    return g.length ? g : ['Health'];
  }, [stored]);

  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<GoalId>(goals[0]);
  // Deselecting the picked goal falls back to the first remaining one (prototype behaviour).
  const first: GoalId = goals.includes(picked) ? picked : goals[0];
  const finishing = useRef(false);

  // Android hardware back walks back through the steps; on step 1 it leaves as usual.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 0) return false;
      setStep(step - 1);
      return true;
    });
    return () => sub.remove();
  }, [step]);

  const toggleGoal = (id: GoalId) => {
    const next = goals.includes(id) ? goals.filter((g) => g !== id) : [...goals, id];
    if (!next.length) return; // at least one goal stays selected
    haptic.selection();
    setGoals(next);
  };

  const pickFirst = (id: GoalId) => {
    haptic.selection();
    setPicked(id);
  };

  const finish = () => {
    if (finishing.current) return;
    finishing.current = true;
    const s = SUGG[first];
    useData.getState().addHabit({
      name: s.name,
      icon: s.icon,
      hue: s.hue,
      category: s.category,
      frequency: { type: 'daily' },
      goal: s.goal,
      unit: s.unit,
      step: s.step,
      timeOfDay: 'Anytime',
      reminder: null,
      notes: null,
    });
    useOnboarding.getState().markSeen();
    playSound('complete');
    haptic.success();
    toast('Your first habit is planted', 'leaf');
    // Signed out: flipping `seen` makes the root guard swap this screen for sign-in.
    if (useAuth.getState().user) router.replace('/');
  };

  const next = () => {
    if (step < FIRST_STEP) setStep(step + 1);
    else finish();
  };

  const slide = step < GOALS_STEP;
  const cta =
    step === 4 ? 'Get started' : step === FIRST_STEP ? `Start with ${SUGG[first].name}` : 'Continue';

  const padX = isTablet ? Math.max(48, (width - 560) / 2) : 24;
  const padTop = isTablet ? Math.max(48, insets.top + 24) : Math.max(64, insets.top + 12);
  const padBottom = isTablet ? Math.max(48, insets.bottom + 24) : Math.max(36, insets.bottom + 16);

  const Slide = slide ? SLIDES[step] : null;
  const glow = splitAlpha(c.a1soft);

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      {/* radial-gradient(420px 360px at 50% 20%, a1soft, transparent 70%) */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id={glowId} cx={width / 2} cy={height * 0.2} rx={420} ry={360} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={glow.color} stopOpacity={glow.opacity} />
            <Stop offset="0.7" stopColor={glow.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={width / 2} cy={height * 0.2} rx={420} ry={360} fill={`url(#${glowId})`} />
      </Svg>

      <View
        style={[
          styles.column,
          {
            paddingTop: padTop,
            paddingBottom: padBottom,
            paddingLeft: padX + insets.left,
            paddingRight: padX + insets.right,
          },
        ]}
      >
        <View style={styles.header}>
          <Dots step={step} />
          {slide && (
            <PressableScale
              onPress={() => setStep(GOALS_STEP)}
              hitSlop={12}
              accessibilityLabel="Skip intro"
              style={styles.skip}
            >
              <Text style={styles.skipText} color="ink2">
                Skip
              </Text>
            </PressableScale>
          )}
        </View>

        {Slide ? (
          <StepEnter key={step} style={styles.body}>
            <Slide />
            <View style={styles.copy}>
              <Text style={styles.slideTitle} accessibilityRole="header">
                {OB[step].t}
              </Text>
              <Text style={styles.slideBody} color="ink2">
                {OB[step].b}
              </Text>
            </View>
          </StepEnter>
        ) : (
          <StepEnter key={step} style={styles.fill}>
            <ScrollView style={styles.fill} contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
              {step === GOALS_STEP ? (
                <>
                  <View style={styles.formHead}>
                    <Text style={styles.formTitle} accessibilityRole="header">
                      What do you want to grow?
                    </Text>
                    <Text color="ink2">Pick as many as you like. You can change this later.</Text>
                  </View>
                  <View style={styles.grid}>
                    {[0, 2, 4].map((r) => (
                      <View key={r} style={styles.gridRow}>
                        {GOALS.slice(r, r + 2).map((g) => (
                          <GoalCard key={g.id} id={g.id} icon={g.icon} on={goals.includes(g.id)} onPress={toggleGoal} />
                        ))}
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.formHead}>
                    <Text style={styles.formTitle} accessibilityRole="header">
                      Create your first habit
                    </Text>
                    <Text color="ink2">Start tiny. We picked a few based on your goals.</Text>
                  </View>
                  <View style={styles.list} accessibilityRole="radiogroup">
                    {goals.map((g) => (
                      <SuggestionRow key={g} goal={g} on={g === first} onPress={pickFirst} />
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
          </StepEnter>
        )}

        <Button label={cta} onPress={next} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  column: { flex: 1, gap: 20 },
  header: { height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { height: 7, borderRadius: 4 },
  skip: { minHeight: 32, justifyContent: 'center', paddingLeft: 8 },
  skipText: { fontFamily: fonts.body600, fontSize: 14.5 },

  body: { flex: 1, gap: 20 },
  stage: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  round: { borderRadius: 999 },
  copy: { gap: 10 },
  slideTitle: { fontFamily: fonts.display700, fontSize: 36, lineHeight: 38, letterSpacing: -1.26 },
  slideBody: { fontFamily: fonts.body400, fontSize: 16, lineHeight: 23 },

  pill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 21,
    borderWidth: 1,
  },
  pillMark: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontFamily: fonts.body600, fontSize: 14 },

  timeChip: {
    position: 'absolute',
    bottom: 34,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    justifyContent: 'center',
  },
  timeChipText: { fontFamily: fonts.display700, fontSize: 15, lineHeight: 19 },

  barsStage: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  bars: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 200,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
    paddingHorizontal: 10,
  },
  bar: {
    flex: 1,
    opacity: 0.85,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    transformOrigin: 'bottom',
  },

  rays: { position: 'absolute', top: 10, left: 10, width: 260, height: 260 },

  form: { gap: 18, paddingBottom: 8 },
  formHead: { gap: 8 },
  formTitle: { fontFamily: fonts.display700, fontSize: 32, lineHeight: 34, letterSpacing: -0.96 },
  grid: { gap: 10 },
  gridRow: { flexDirection: 'row', gap: 10 },
  goal: { flex: 1, gap: 12, padding: 16, borderRadius: 22, borderWidth: 1.5 },
  goalIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  goalLabel: { fontFamily: fonts.body700, fontSize: 15.5, lineHeight: 20 },
  goalCheck: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  list: { gap: 10 },
  sugg: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22, borderWidth: 1.5 },
  suggText: { flex: 1 },
  suggName: { fontFamily: fonts.body700, fontSize: 15, lineHeight: 20 },
  suggSub: { fontFamily: fonts.body400, fontSize: 13, lineHeight: 18 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
});
