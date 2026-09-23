import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { Ring } from '@/components/ui/Ring';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

/** Gradient initial inside an XP progress ring (Home header, Profile). */
export function Avatar({ name, progress, size = 44, ring = 2.5 }: { name: string; progress: number; size?: number; ring?: number }) {
  const { c } = useTheme();
  const inner = size - ring * 2 - 4;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute' }}>
        <Ring size={size} stroke={ring} progress={progress} color={c.a1} />
      </View>
      <View style={{ width: inner + 4, height: inner + 4, borderRadius: size, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient
          colors={[c.a2, c.a1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{ width: inner, height: inner, borderRadius: inner / 2, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: fonts.display700, fontSize: inner * 0.45, color: c.a1ink }}>{(name.trim()[0] ?? 'T').toUpperCase()}</Text>
        </LinearGradient>
      </View>
    </View>
  );
}
