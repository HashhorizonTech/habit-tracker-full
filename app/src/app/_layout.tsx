import { BlurTargetView } from 'expo-blur';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Sidebar } from '@/components/nav/Sidebar';
import { RootBlurTarget } from '@/components/overlay/Backdrop';
import { ModalHost } from '@/components/overlay/ModalHost';
import { SheetHost } from '@/components/overlay/SheetHost';
import { ToastHost } from '@/components/overlay/ToastHost';
import { useAuth } from '@/api/auth';
import { startSync, useSync } from '@/api/sync';
import { startPrefsSync } from '@/lib/prefsSync';
import { useReminderSync } from '@/lib/reminders';
import { applyStreakProtection } from '@/lib/streakProtection';
import { initSounds } from '@/audio/sounds';
import { useFocusEngine } from '@/focus/engine';
import { initNotifications } from '@/lib/notifications';
import { useResponsive } from '@/lib/responsive';
import { usePersistHydrated } from '@/lib/usePersistHydrated';
import { useDataHydrated } from '@/store/data';
import { ThemeProvider, useTendFonts, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Shell() {
  const { dark, c } = useTheme();
  const { isDesktop } = useResponsive();
  const blurTarget = useRef<View>(null);
  const user = useAuth((s) => s.user);
  const signedIn = !!user;
  useFocusEngine();
  useReminderSync();
  return (
    <RootBlurTarget.Provider value={blurTarget}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <BlurTargetView ref={blurTarget} style={[styles.row, { backgroundColor: c.page }]}>
        {isDesktop && signedIn && <Sidebar />}
        <View style={styles.fill}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: c.bg },
              // Screen content adds the 12px slide-up; the native transition only fades.
              animation: isDesktop ? 'none' : 'fade',
              animationDuration: 350,
            }}
          >
            <Stack.Protected guard={signedIn}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="tasks" />
              <Stack.Screen name="calendar" />
              <Stack.Screen name="achievements" />
              <Stack.Screen name="summary" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="themes" />
              <Stack.Screen name="notifications" />
              <Stack.Screen name="habit/[id]" />
              <Stack.Screen name="dev/design-system" />
            </Stack.Protected>
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="sign-in" />
            </Stack.Protected>
          </Stack>
        </View>
      </BlurTargetView>
      <SheetHost />
      <ModalHost />
      <ToastHost />
    </RootBlurTarget.Provider>
  );
}

export default function RootLayout() {
  const fontsReady = useTendFonts();
  const dataReady = useDataHydrated();
  const authReady = usePersistHydrated(useAuth.persist);
  const ready = fontsReady && dataReady && authReady;
  useEffect(() => {
    void initSounds();
    void initNotifications();
  }, []);
  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});
    startSync();
    startPrefsSync();
    applyStreakProtection();
    const app = AppState.addEventListener('change', (st) => st === 'active' && applyStreakProtection());
    // Remote changes (e.g. check-ins from another device) can change which days need cover.
    const sync = useSync.subscribe((s, prev) => s.status === 'idle' && prev.status === 'syncing' && applyStreakProtection());
    return () => {
      app.remove();
      sync();
    };
  }, [ready]);
  if (!ready) return null;
  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Shell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
});
