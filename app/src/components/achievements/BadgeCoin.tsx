import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, type IconName } from '@/components/icons/Icon';
import { Ring } from '@/components/ui/Ring';
import { useTheme } from '@/theme';

export interface BadgeCoinProps {
  icon: IconName;
  unlocked: boolean;
  /** 0–1; drawn as the ring around the coin (full when unlocked). */
  progress: number;
  size?: number;
  /** Ring thickness (the prototype's conic "padding"). */
  ring?: number;
  /** Gap between ring and disc, painted in `borderColor`. */
  border?: number;
  borderColor?: string;
  iconSize?: number;
  iconStroke?: number;
  /** Show the small lock pip at the bottom-right (locked grid coins). */
  lockPip?: boolean;
}

// CSS linear-gradient(150deg, a2, a1) expressed as start/end points.
const G_START = { x: 0.25, y: 0.07 };
const G_END = { x: 0.75, y: 0.93 };

/** Achievement coin: conic progress ring around an a2→a1 disc (unlocked) or a muted one (SPEC §4.11). */
export const BadgeCoin = memo(function BadgeCoin({
  icon,
  unlocked,
  progress,
  size = 78,
  ring = 4,
  border = 3,
  borderColor,
  iconSize = 28,
  iconStroke = 1.9,
  lockPip,
}: BadgeCoinProps) {
  const { c } = useTheme();
  const disc = size - ring * 2;
  return (
    <View style={{ width: size, height: size }} accessible={false}>
      <Ring size={size} stroke={ring} progress={unlocked ? 1 : progress} color={c.a1} />
      <View
        style={[
          styles.disc,
          {
            top: ring,
            left: ring,
            width: disc,
            height: disc,
            borderRadius: disc / 2,
            borderWidth: border,
            borderColor: borderColor ?? c.bg,
            backgroundColor: unlocked ? c.a1 : c.surface2,
          },
        ]}
      >
        {unlocked && <LinearGradient colors={[c.a2, c.a1]} start={G_START} end={G_END} style={StyleSheet.absoluteFill} />}
        <Icon name={icon} size={iconSize} color={unlocked ? c.a1ink : c.ink3} strokeWidth={iconStroke} filled={false} />
      </View>
      {lockPip && !unlocked && (
        <View style={[styles.pip, { backgroundColor: c.surface2, borderColor: borderColor ?? c.bg }]}>
          <Icon name="lock" size={12} color={c.ink3} strokeWidth={2.4} />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  disc: { position: 'absolute', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pip: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
