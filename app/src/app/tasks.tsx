import { Placeholder } from '@/components/ui/Placeholder';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function TasksScreen() {
  return (
    <Screen>
      <ScreenHeader title="Tasks" back desktopRoot />
      <Placeholder step={5} what="Timeline, quick add and swipe actions" />
    </Screen>
  );
}
