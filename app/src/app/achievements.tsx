import { Placeholder } from '@/components/ui/Placeholder';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function AchievementsScreen() {
  return (
    <Screen>
      <ScreenHeader title="Achievements" back desktopRoot />
      <Placeholder step={6} what="Level hero and badges" />
    </Screen>
  );
}
