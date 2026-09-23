import { useCallback, useEffect } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Burst } from '@/components/ui/Burst';
import { useUI, type ModalRequest } from '@/store/ui';
import { useTheme, useThemedColor } from '@/theme';
import { duration, easing } from '@/theme/motion';
import { radius } from '@/theme/tokens';
import { Backdrop } from './Backdrop';

function Card({ req, onClosed }: { req: ModalRequest; onClosed: () => void }) {
  const { c, reduceMotion } = useTheme();
  const bg = useThemedColor('sheet');
  const progress = useSharedValue(0);
  const s = useSharedValue(reduceMotion ? 1 : 0.7);

  useEffect(() => {
    progress.set(withTiming(1, { duration: duration.backdrop }));
    if (!reduceMotion) {
      // scale .7 → 1.04 → 1 over ~500 ms (SPEC §5 Modal)
      s.set(
        withSequence(
          withTiming(1.04, { duration: duration.modal * 0.6, easing: easing.out }),
          withTiming(1, { duration: duration.modal * 0.4, easing: easing.inOut }),
        ),
      );
    }
  }, [progress, s, reduceMotion]);

  const close = useCallback(() => {
    progress.set(
      withTiming(0, { duration: duration.sheetOut }, (done) => {
        if (done) runOnJS(onClosed)();
      }),
    );
  }, [progress, onClosed]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const card = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ scale: s.value }] }));

  return (
    <View style={[StyleSheet.absoluteFill, styles.center]} accessibilityViewIsModal>
      <Backdrop progress={progress} onPress={close} intensity={30} dim={0.6} label="Close" />
      <Animated.View style={[styles.card, { borderColor: c.line }, bg, card]} accessibilityLabel={req.label}>
        {req.burst && (
          <View style={styles.burstAnchor} pointerEvents="none">
            <Burst big />
          </View>
        )}
        {req.render(close)}
      </Animated.View>
    </View>
  );
}

/** Centered modal card with pop-in, blurred backdrop and optional confetti (SPEC §4.7, §4.11). */
export function ModalHost() {
  const modal = useUI((s) => s.modal);
  const closeModal = useUI((s) => s.closeModal);
  if (!modal) return null;
  return <Card key={modal.key} req={modal} onClosed={closeModal} />;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 12,
    paddingTop: 30,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderRadius: radius.xl,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 30 },
    elevation: 30,
  },
  burstAnchor: { position: 'absolute', left: 0, right: 0, top: 0, height: 180 },
});
