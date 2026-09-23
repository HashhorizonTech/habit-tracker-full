import { Placeholder } from '@/components/ui/Placeholder';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function NotificationsScreen() {
  return (
    <Screen>
      <ScreenHeader title="Notifications" back />
      <Placeholder step={7} what="Tone, quiet hours and reminders" />
    </Screen>
  );
}
