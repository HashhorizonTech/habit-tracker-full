import { useLocalSearchParams } from 'expo-router';
import { Placeholder } from '@/components/ui/Placeholder';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen>
      <ScreenHeader title="Habit" subtitle={id} back />
      <Placeholder step={3} what="Streak hero, heatmap and charts" />
    </Screen>
  );
}
