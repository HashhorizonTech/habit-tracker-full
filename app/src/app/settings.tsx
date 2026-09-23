import { Placeholder } from '@/components/ui/Placeholder';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function SettingsScreen() {
  return (
    <Screen>
      <ScreenHeader title="Settings" back />
      <Placeholder step={7} what="Appearance, focus, habits, privacy" />
    </Screen>
  );
}
