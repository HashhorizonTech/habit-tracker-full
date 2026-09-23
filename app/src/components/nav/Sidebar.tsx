import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icons/Icon';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { XpBar } from '@/components/ui/XpBar';
import { openCreateHabit } from '@/lib/actions';
import { useTheme, useThemedColor } from '@/theme';
import { fonts, layout } from '@/theme/tokens';
import { Logo } from './Logo';
import { SIDEBAR } from './routes';

/** Desktop / large-tablet sidebar, 248px (SPEC §3). */
export function Sidebar() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const bg = useThemedColor('page');
  return (
    <Animated.View
      style={[styles.side, { paddingTop: 28 + insets.top, paddingBottom: 24 + insets.bottom, borderRightColor: c.line }, bg]}
      accessibilityRole="menu"
    >
      <View style={{ paddingHorizontal: 10 }}>
        <Logo />
      </View>
      <View style={styles.nav}>
        {SIDEBAR.map((item) => {
          const on = item.match(pathname);
          return (
            <Pressable
              key={item.id}
              onPress={() => router.navigate(item.href)}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: on }}
              style={({ hovered, pressed }) => [
                styles.item,
                { backgroundColor: on ? c.a1soft : hovered || pressed ? c.surface2 : 'transparent' },
              ]}
            >
              <Icon name={item.icon} size={20} color={on ? c.a1text : c.ink2} />
              <Text style={{ fontFamily: on ? fonts.body700 : fonts.body600, fontSize: 15, color: on ? c.a1text : c.ink2 }}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flex: 1 }} />
      <View style={[styles.levelCard, { backgroundColor: c.surface, borderColor: c.line }]}>
        <XpBar compact />
      </View>
      <Button label="New habit" icon="plus" size="md" onPress={() => openCreateHabit()} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  side: { width: layout.sidebarWidth, paddingHorizontal: 18, gap: 22, borderRightWidth: StyleSheet.hairlineWidth },
  nav: { gap: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 44, paddingHorizontal: 12, borderRadius: 14 },
  levelCard: { padding: 16, borderRadius: 20, borderWidth: 1, gap: 10 },
});
