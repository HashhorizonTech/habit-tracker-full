import { Placeholder } from '@/components/ui/Placeholder';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function HabitsScreen() {
  return (
    <Screen tab>
      <ScreenHeader title="My habits" />
      <Placeholder step={3} what="Habit list, filters, reorder and swipe" />
    </Screen>
  );
}
