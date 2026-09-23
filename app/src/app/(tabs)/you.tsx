import { Placeholder } from '@/components/ui/Placeholder';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function YouScreen() {
  return (
    <Screen tab>
      <ScreenHeader title="You" />
      <Placeholder step={7} what="Profile, badges and settings links" />
    </Screen>
  );
}
