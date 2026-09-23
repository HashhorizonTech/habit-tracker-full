import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import type { Task } from '@/data/types';
import { toggleTaskDone } from '@/lib/checkIn';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';
import { TaskCheck } from './TaskCheck';

/** Time column + hairline + priority dot + checkbox + title (Home "Up next", Tasks). */
export function TimelineRow({ task, children, right }: { task: Task; children?: ReactNode; right?: ReactNode }) {
  const { c, fixed } = useTheme();
  return (
    <View style={styles.grid}>
      <Text style={styles.time} color="ink3" tabular>{task.time ?? 'Any'}</Text>
      <View style={[styles.body, { borderLeftColor: c.line }]}>
        <View style={[styles.dot, { backgroundColor: fixed.priority[task.priority] }]} />
        <TaskCheck done={task.done} priority={task.priority} onPress={() => toggleTaskDone(task.id)} label={`${task.done ? 'Completed' : 'Complete'}: ${task.title}`} />
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Text
            style={[styles.title, task.done && { textDecorationLine: 'line-through' }]}
            color={task.done ? 'ink3' : 'ink'}
            numberOfLines={1}
          >
            {task.title}
          </Text>
          {children}
        </View>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', alignItems: 'stretch' },
  time: { width: 48, paddingTop: 15, fontFamily: fonts.body600, fontSize: 12.5 },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 18, borderLeftWidth: 1.5 },
  dot: { position: 'absolute', left: -5, top: 21, width: 8, height: 8, borderRadius: 4 },
  title: { fontFamily: fonts.body600, fontSize: 15 },
});
