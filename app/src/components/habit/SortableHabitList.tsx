// Long-press + drag to reorder, swipe right to complete (SPEC §4.4). Rows share one
// measured height and are absolutely positioned; positions live in a shared value so
// dragging never re-renders React.
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Icon } from '@/components/icons/Icon';
import { completeNow } from '@/lib/checkIn';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme';
import { spring } from '@/theme/motion';
import { HabitListRow, type HabitListItem } from './HabitListRow';

const SWIPE_DONE = 96;

type Positions = Record<string, number>;

function Row({
  item,
  index,
  positions,
  height,
  count,
  onDragState,
  onDrop,
}: {
  item: HabitListItem;
  index: number;
  positions: SharedValue<Positions>;
  height: number;
  count: number;
  onDragState: (dragging: boolean) => void;
  onDrop: () => void;
}) {
  const { c, habit } = useTheme();
  const id = item.habit.id;
  const col = habit(item.habit.hue);
  const bg = c.bg;
  const done = item.count >= item.habit.goal;
  const top = useSharedValue(index * height);
  const dragging = useSharedValue(false);
  const lift = useSharedValue(0);
  const startTop = useSharedValue(0);
  const swipeX = useSharedValue(0);

  // Follow position changes caused by other rows moving.
  useAnimatedReaction(
    () => positions.value[id],
    (idx, prev) => {
      if (idx !== prev && !dragging.value && idx != null) top.set(withSpring(idx * height, spring.settle));
    },
  );

  useEffect(() => {
    top.set(index * height);
  }, [height, index, top]);

  const drag = Gesture.Pan()
    .activateAfterLongPress(320)
    .onStart(() => {
      dragging.set(true);
      startTop.set(top.value);
      lift.set(withTiming(1, { duration: 150 }));
      runOnJS(onDragState)(true);
      runOnJS(haptic.medium)();
    })
    .onUpdate((e) => {
      top.set(startTop.value + e.translationY);
      const next = Math.max(0, Math.min(count - 1, Math.round(top.value / height)));
      const cur = positions.value[id];
      if (next !== cur) {
        const moved: Positions = { ...positions.value };
        for (const k of Object.keys(moved)) if (moved[k] === next) moved[k] = cur;
        moved[id] = next;
        positions.set(moved);
        runOnJS(haptic.selection)();
      }
    })
    .onFinalize(() => {
      if (!dragging.value) return;
      dragging.set(false);
      top.set(withSpring(positions.value[id] * height, spring.settle));
      lift.set(withTiming(0, { duration: 200 }));
      runOnJS(onDragState)(false);
      runOnJS(onDrop)();
    });

  const swipe = Gesture.Pan()
    .activeOffsetX(18)
    .failOffsetX(-12)
    .failOffsetY([-14, 14])
    .enabled(!done)
    .onUpdate((e) => {
      swipeX.set(Math.max(0, e.translationX));
    })
    .onEnd(() => {
      if (swipeX.value > SWIPE_DONE) runOnJS(completeNow)(id);
      swipeX.set(withSpring(0, spring.settle));
    });

  const rowStyle = useAnimatedStyle(() => ({
    top: top.value,
    zIndex: dragging.value ? 10 : 0,
    transform: [{ scale: 1 + 0.02 * lift.value }],
    shadowOpacity: 0.35 * lift.value,
    // Opaque only while lifted, so the screen glow shows through at rest.
    backgroundColor: lift.value > 0.01 ? bg : 'transparent',
  }));
  const content = useAnimatedStyle(() => ({ transform: [{ translateX: swipeX.value }] }));
  const reveal = useAnimatedStyle(() => ({ opacity: Math.min(1, swipeX.value / SWIPE_DONE), transform: [{ scale: swipeX.value > SWIPE_DONE ? 1.15 : 1 }] }));

  return (
    <Animated.View style={[styles.row, { height, shadowColor: '#000', borderRadius: 18 }, rowStyle]}>
      <Animated.View style={[styles.reveal, { backgroundColor: col.soft }, reveal]} pointerEvents="none">
        <Icon name="check" size={22} color={col.text} strokeWidth={2.6} />
      </Animated.View>
      <GestureDetector gesture={Gesture.Race(drag, swipe)}>
        <Animated.View style={content}>
          <HabitListRow item={item} />
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

export function SortableHabitList({ items, onReorder, onDragState }: {
  items: HabitListItem[];
  onReorder: (orderedIds: string[]) => void;
  onDragState: (dragging: boolean) => void;
}) {
  const [height, setHeight] = useState(0);
  const ids = items.map((it) => it.habit.id).join('|');
  const positions = useSharedValue<Positions>({});

  useEffect(() => {
    positions.set(Object.fromEntries(ids.split('|').map((id, i) => [id, i])));
  }, [ids, positions]);

  const drop = useCallback(() => {
    const p = positions.get();
    onReorder(Object.keys(p).sort((a, b) => p[a] - p[b]));
  }, [positions, onReorder]);

  if (!items.length) return null;
  if (!height) {
    // Measure one row (all rows render normally meanwhile), then switch to absolute layout.
    return (
      <View>
        {items.map((it, i) => (
          <View key={it.habit.id} onLayout={i === 0 ? (e) => setHeight(e.nativeEvent.layout.height) : undefined}>
            <HabitListRow item={it} />
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={{ height: height * items.length }} accessibilityHint="Long-press a habit and drag to reorder. Swipe right to complete.">
      {items.map((it, i) => (
        <Row key={it.habit.id} item={it} index={i} positions={positions} height={height} count={items.length} onDragState={onDragState} onDrop={drop} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', left: 0, right: 0, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  reveal: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 120, borderRadius: 18, alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 22 },
});
