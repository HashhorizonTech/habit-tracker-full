import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Mascot } from '@/components/illustration';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Placeholder } from '@/components/ui/Placeholder';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { useUI, toast } from '@/store/ui';
import { useTheme } from '@/theme';
import { space } from '@/theme/tokens';

// Temporary Today screen with a shell test panel. Step 3 replaces it with the real Home.
export default function TodayScreen() {
  const { c } = useTheme();
  const { openSheet, openModal, calm, setCalm } = useUI();
  return (
    <Screen tab>
      <ScreenHeader
        eyebrow="Step 2 · Shell check"
        title="Good morning, Ravi"
        subtitle="Let's make today count."
        right={<IconButton icon="calendar" label="Open calendar" onPress={() => router.push('/calendar')} />}
      />
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Text variant="caption" color="ink3">Overlays</Text>
        <Button label="Show toast" size="md" variant="secondary" onPress={() => toast('Drink water complete · +10 XP', 'sparkle')} />
        <Button
          label="Open sheet"
          size="md"
          variant="secondary"
          onPress={() =>
            openSheet(
              (close) => (
                <View style={{ gap: space[4] }}>
                  <Text variant="h2">Sheet</Text>
                  <Text color="ink2">Drag the grabber down, tap outside, or press Android back to close.</Text>
                  {Array.from({ length: 6 }, (_, i) => (
                    <View key={i} style={{ height: 56, borderRadius: 16, backgroundColor: c.surface2 }} />
                  ))}
                  <Button label="Close" onPress={close} />
                </View>
              ),
              'Test sheet',
            )
          }
        />
        <Button
          label="Open modal"
          size="md"
          variant="secondary"
          onPress={() =>
            openModal(
              (close) => (
                <>
                  <Mascot size={120} face="wow" accessory="sparkle" />
                  <Text variant="h2" align="center">Focus session complete!</Text>
                  <Button label="Nice!" onPress={close} style={{ alignSelf: 'stretch', marginTop: 8 }} />
                </>
              ),
              'Test modal',
              { burst: true },
            )
          }
        />
        <Button label={calm ? 'Exit immersive mode' : 'Immersive mode (hide tab bar)'} size="md" variant="secondary" onPress={() => setCalm(!calm)} />
      </View>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Text variant="caption" color="ink3">Pushed screens</Text>
        <View style={styles.wrap}>
          {(['/tasks', '/calendar', '/summary', '/achievements', '/settings', '/themes', '/notifications', '/habit/read', '/dev/design-system'] as const).map((href) => (
            <Button key={href} label={href} size="sm" variant="ghost" onPress={() => router.push(href)} />
          ))}
        </View>
      </View>
      <Placeholder step={3} what="Day dial, mood strip, habits, focus card" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[3], padding: space[4], borderRadius: 24, borderWidth: 1, marginBottom: space[4] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
});
