import { Placeholder } from '@/components/ui/Placeholder';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function ThemesScreen() {
  return (
    <Screen>
      <ScreenHeader title="Themes" back />
      <Placeholder step={7} what="Theme selector" />
    </Screen>
  );
}
