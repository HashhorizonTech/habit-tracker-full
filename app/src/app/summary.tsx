import { Placeholder } from '@/components/ui/Placeholder';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function SummaryScreen() {
  return (
    <Screen>
      <ScreenHeader title="Your day" back />
      <Placeholder step={6} what="Daily summary journal page" />
    </Screen>
  );
}
