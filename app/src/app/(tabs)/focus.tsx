import { Placeholder } from '@/components/ui/Placeholder';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function FocusScreen() {
  return (
    <Screen tab>
      <ScreenHeader title="Focus" />
      <Placeholder step={4} what="Pomodoro timer and immersive mode" />
    </Screen>
  );
}
