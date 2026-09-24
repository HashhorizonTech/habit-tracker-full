import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Icon, type IconName } from '@/components/icons/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import type { Task } from '@/data/types';
import { haptic } from '@/lib/haptics';
import { alpha, useTheme } from '@/theme';
import { spring } from '@/theme/motion';
import { fonts } from '@/theme/tokens';
import { TaskCheck } from './TaskCheck';

const SWIPE = 96;
const PRIORITY_LABEL = { high: 'High', med: 'Medium', low: 'Low' } as const;

export interface TaskRowProps {
  task: Task;
  /** Left column: "10:00", "Thu", "Sep 28", "Any". */
  when: string;
  habitName: string | null;
  menuOpen: boolean;
  onToggle: () => void;
  onMenu: () => void;
  onFocus: () => void;
  onMakeHabit: () => void;
  onDelete: () => void;
}

function MetaChip({ icon, dot, label, bg, fg }: { icon?: IconName; dot?: string; label: string; bg: string; fg: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {dot && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} />}
      {icon && <Icon name={icon} size={12} color={fg} strokeWidth={2.2} />}
      <Text style={{ fontFamily: fonts.body700, fontSize: 12, color: fg }}>{label}</Text>
    </View>
  );
}

/**
 * Tasks timeline row (SPEC §4.8): time column + hairline + priority dot, checkbox, title with
 * strike-through, meta chips, inline ⋯ menu. Swipe right completes, swipe left deletes.
 */
export const TaskRow = memo(function TaskRow({ task, when, habitName, menuOpen, onToggle, onMenu, onFocus, onMakeHabit, onDelete }: TaskRowProps) {
  const { c, fixed } = useTheme();
  const x = useSharedValue(0);
  const pc = fixed.priority[task.priority];

  const pan = Gesture.Pan()
    .activeOffsetX([-18, 18])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      // Completed tasks can only be deleted.
      x.set(task.done ? Math.min(0, e.translationX) : e.translationX);
    })
    .onEnd(() => {
      if (x.value > SWIPE) {
        runOnJS(onToggle)();
        x.set(withSpring(0, spring.settle));
      } else if (x.value < -SWIPE) {
        runOnJS(haptic.medium)();
        x.set(withTiming(-600, { duration: 200 }, () => runOnJS(onDelete)()));
      } else x.set(withSpring(0, spring.settle));
    });

  const content = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const doneReveal = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, x.value) / SWIPE) }));
  const delReveal = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, -x.value) / SWIPE) }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.reveal, styles.revealLeft, { backgroundColor: c.a1soft }, doneReveal]} pointerEvents="none">
        <Icon name="check" size={20} color={c.a1text} strokeWidth={2.6} />
      </Animated.View>
      <Animated.View style={[styles.reveal, styles.revealRight, { backgroundColor: alpha(fixed.priority.high, 0.16) }, delReveal]} pointerEvents="none">
        <Icon name="trash" size={20} color={fixed.priority.high} />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.grid, content]} accessibilityHint="Swipe right to complete, left to delete">
          <Text style={styles.time} color="ink3" tabular numberOfLines={1}>{when}</Text>
          <View style={[styles.body, { borderLeftColor: c.line }]}>
            <View style={[styles.dot, { backgroundColor: pc }]} />
            <View style={styles.top}>
              <View style={{ marginTop: 1 }}>
                <TaskCheck done={task.done} priority={task.priority} onPress={onToggle} label={`${task.done ? 'Completed' : 'Complete'}: ${task.title}`} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
                <Text style={[styles.title, task.done && { textDecorationLine: 'line-through' }]} color={task.done ? 'ink3' : 'ink'}>
                  {task.title}
                </Text>
                <View style={styles.chips}>
                  <MetaChip dot={pc} label={PRIORITY_LABEL[task.priority]} bg={c.surface2} fg={c.ink2} />
                  {habitName && <MetaChip icon="habits" label={habitName} bg={c.a2soft} fg={c.ink2} />}
                  {task.focusSessions > 0 && <MetaChip icon="focus" label={`${task.focusSessions} × 25m`} bg={c.a1soft} fg={c.a1text} />}
                </View>
              </View>
              <Pressable onPress={onMenu} hitSlop={8} accessibilityRole="button" accessibilityLabel={`More actions for ${task.title}`} accessibilityState={{ expanded: menuOpen }} style={styles.more}>
                <Icon name="more" size={20} color={c.ink3} strokeWidth={2.6} />
              </Pressable>
            </View>
            {menuOpen && (
              <Animated.View entering={FadeIn.duration(250)} style={styles.menu}>
                {!task.done && (
                  <PressableScale onPress={onFocus} style={[styles.menuBtn, { backgroundColor: c.a1 }]} accessibilityLabel={`Focus on ${task.title}`}>
                    <Text style={[styles.menuText, { color: c.a1ink }]}>Focus on this</Text>
                  </PressableScale>
                )}
                <PressableScale onPress={onMakeHabit} style={[styles.menuBtn, { borderWidth: 1, borderColor: c.line }]} accessibilityLabel={`Make ${task.title} a habit`}>
                  <Icon name="repeat" size={14} color={c.ink} />
                  <Text style={styles.menuText}>Make it a habit</Text>
                </PressableScale>
                <PressableScale onPress={onDelete} style={styles.menuBtn} accessibilityLabel={`Delete ${task.title}`}>
                  <Text style={[styles.menuText, { color: fixed.priority.high }]}>Delete</Text>
                </PressableScale>
              </Animated.View>
            )}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  reveal: { position: 'absolute', top: 6, bottom: 6, width: 110, borderRadius: 18, justifyContent: 'center' },
  revealLeft: { left: 0, alignItems: 'flex-start', paddingLeft: 20 },
  revealRight: { right: 0, alignItems: 'flex-end', paddingRight: 20 },
  grid: { flexDirection: 'row', alignItems: 'stretch' },
  time: { width: 52, paddingTop: 18, fontFamily: fonts.body600, fontSize: 12.5 },
  body: { flex: 1, gap: 10, paddingVertical: 12, paddingLeft: 18, borderLeftWidth: 1.5 },
  dot: { position: 'absolute', left: -5, top: 24, width: 8, height: 8, borderRadius: 4 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontFamily: fonts.body600, fontSize: 15.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 24, paddingHorizontal: 9, borderRadius: 12 },
  more: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  menu: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 40 },
  menuBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, paddingHorizontal: 12, borderRadius: 12 },
  menuText: { fontFamily: fonts.body700, fontSize: 13 },
});
