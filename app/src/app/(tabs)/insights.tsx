import { Placeholder } from '@/components/ui/Placeholder';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function InsightsScreen() {
  return (
    <Screen tab>
      <ScreenHeader title="Insights" />
      <Placeholder step={5} what="Habits and Focus analytics" />
    </Screen>
  );
}
