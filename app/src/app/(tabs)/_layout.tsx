import { BlurTargetView } from 'expo-blur';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { TabBar } from '@/components/nav/TabBar';
import { useResponsive } from '@/lib/responsive';

/** Five main tabs. Phones/tablets get the floating tab bar; desktop uses the root sidebar. */
export default function TabsLayout() {
  const { isDesktop } = useResponsive();
  const target = useRef<View>(null);
  return (
    <Tabs style={styles.fill}>
      <BlurTargetView ref={target} style={styles.fill}>
        <TabSlot />
      </BlurTargetView>
      {!isDesktop && <TabBar blurTarget={target} />}
      {/* Route declarations only; the visible bar is <TabBar />. */}
      <TabList style={styles.hidden}>
        <TabTrigger name="index" href="/" />
        <TabTrigger name="habits" href="/habits" />
        <TabTrigger name="focus" href="/focus" />
        <TabTrigger name="insights" href="/insights" />
        <TabTrigger name="you" href="/you" />
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: 'none' },
});
