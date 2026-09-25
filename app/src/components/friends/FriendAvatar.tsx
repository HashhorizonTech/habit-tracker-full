import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

/** Gradient disc with a friend's initial (no XP ring — that's the owner's own avatar). */
export const FriendAvatar = memo(function FriendAvatar({ name, initial, size = 44 }: { name: string; initial?: string; size?: number }) {
  const { c } = useTheme();
  const letter = (initial || name.trim()[0] || '?').toUpperCase();
  return (
    <LinearGradient
      colors={[c.a2, c.a1]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontFamily: fonts.display700, fontSize: size * 0.42, lineHeight: size * 0.52, color: c.a1ink }}>{letter}</Text>
    </LinearGradient>
  );
});
