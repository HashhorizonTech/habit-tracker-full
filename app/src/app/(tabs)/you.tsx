import { useAuth } from '@/api/auth';
import { Button } from '@/components/ui/Button';
import { Placeholder } from '@/components/ui/Placeholder';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { loadDemoData } from '@/lib/demo';

export default function YouScreen() {
  const signOut = useAuth((s) => s.signOut);
  return (
    <Screen tab>
      <ScreenHeader title="You" />
      <Placeholder step={7} what="Profile, badges and settings links" />
      {__DEV__ && <Button label="Load demo data (dev)" variant="secondary" size="md" onPress={loadDemoData} />}
      <Button label="Sign out" variant="ghost" size="md" onPress={signOut} style={{ marginTop: 8 }} />
    </Screen>
  );
}
