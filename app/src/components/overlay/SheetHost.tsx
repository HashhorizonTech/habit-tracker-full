import { useCallback, useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUI, type SheetRequest } from '@/store/ui';
import { useTheme, useThemedColor } from '@/theme';
import { duration, easing, spring } from '@/theme/motion';
import { radius } from '@/theme/tokens';
import { Backdrop } from './Backdrop';

function Sheet({ req, onClosed }: { req: SheetRequest; onClosed: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const sheetBg = useThemedColor('sheet');
  const [panelH, setPanelH] = useState(height);
  const progress = useSharedValue(0); // backdrop
  const y = useSharedValue(height); // panel translateY
  const closing = useSharedValue(false);

  useEffect(() => {
    progress.set(withTiming(1, { duration: duration.backdrop }));
    y.set(withTiming(0, { duration: duration.sheetIn, easing: easing.sheet }));
  }, [progress, y]);

  const close = useCallback(() => {
    if (closing.get()) return;
    closing.set(true);
    progress.set(withTiming(0, { duration: duration.sheetOut }));
    y.set(
      withTiming(panelH * 1.05, { duration: duration.sheetOut, easing: easing.exit }, (done) => {
        if (done) runOnJS(onClosed)();
      }),
    );
  }, [closing, progress, y, panelH, onClosed]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  // Drag the grabber/header down to dismiss.
  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate((e) => {
      y.set(Math.max(0, e.translationY));
      progress.set(1 - Math.min(1, y.value / panelH));
    })
    .onEnd((e) => {
      if (y.value > panelH * 0.25 || e.velocityY > 900) runOnJS(close)();
      else {
        y.set(withSpring(0, spring.settle));
        progress.set(withTiming(1, { duration: 200 }));
      }
    });

  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Backdrop progress={progress} onPress={close} intensity={12} dim={0.5} label="Close sheet" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.bottom} pointerEvents="box-none">
        <Animated.View
          onLayout={(e) => setPanelH(e.nativeEvent.layout.height)}
          style={[styles.panel, { maxHeight: height * 0.9, borderColor: c.line }, sheetBg, panel]}
          accessibilityLabel={req.label}
        >
          <GestureDetector gesture={pan}>
            <View style={styles.grabZone}>
              <View style={[styles.grabber, { backgroundColor: c.line }]} />
            </View>
          </GestureDetector>
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 34 + insets.bottom }}
            showsVerticalScrollIndicator={false}
          >
            {req.render(close)}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Bottom sheet host (SPEC §4.5 / §5): 90% max height, top radius 34, grabber, slide 420 ms in / 240 ms out. */
export function SheetHost() {
  const sheet = useUI((s) => s.sheet);
  const closeSheet = useUI((s) => s.closeSheet);
  if (!sheet) return null;
  return <Sheet key={sheet.key} req={sheet} onClosed={closeSheet} />;
}

const styles = StyleSheet.create({
  bottom: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  panel: {
    width: '100%',
    maxWidth: 560,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -20 },
    elevation: 24,
  },
  grabZone: { paddingTop: 10, paddingBottom: 14, alignItems: 'center' },
  grabber: { width: 40, height: 5, borderRadius: 3 },
});
