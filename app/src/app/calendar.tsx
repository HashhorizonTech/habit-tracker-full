import { Placeholder } from '@/components/ui/Placeholder';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function CalendarScreen() {
  return (
    <Screen>
      <ScreenHeader title="Calendar" back desktopRoot />
      <Placeholder step={5} what="Month grid and day sheet" />
    </Screen>
  );
}
