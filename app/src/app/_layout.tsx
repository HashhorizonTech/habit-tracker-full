import { BlurTargetView } from 'expo-blur';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Sidebar } from '@/components/nav/Sidebar';
import { RootBlurTarget } from '@/components/overlay/Backdrop';
import { ModalHost } from '@/components/overlay/ModalHost';
import { SheetHost } from '@/components/overlay/SheetHost';
import { ToastHost } from '@/components/overlay/ToastHost';
import { useResponsive } from '@/lib/responsive';
import { ThemeProvider, useTendFonts, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Shell() {
  const { dark, c } = useTheme();
  const { isDesktop } = useResponsive();
  const blurTarget = useRef<View>(null);
  return (
    <RootBlurTarget.Provider value={blurTarget}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <BlurTargetView ref={blurTarget} style={[styles.row, { backgroundColor: c.page }]}>
        {isDesktop && <Sidebar />}
        <View style={styles.fill}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: c.bg },
              // Screen content adds the 12px slide-up; the native transition only fades.
              animation: isDesktop ? 'none' : 'fade',
              animationDuration: 350,
            }}
          />
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
  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);
  if (!fontsReady) return null;
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
