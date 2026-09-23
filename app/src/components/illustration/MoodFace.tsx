// Five mood faces on a 40-unit viewBox (SPEC §2). Face fill is the pale hue,
// eyes and mouth a dark version of the same hue.
import { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/theme';
import type { MoodId } from '@/theme/palette';

export interface MoodDef {
  id: MoodId;
  label: string;
  eyes: string;
  eyeWidth: number;
  mouth: string;
}

export const MOODS: readonly MoodDef[] = [
  { id: 'great', label: 'Great', eyes: 'M15 18h.01M25 18h.01', eyeWidth: 4, mouth: 'M13 24q7 7 14 0' },
  { id: 'good', label: 'Good', eyes: 'M15 18h.01M25 18h.01', eyeWidth: 4, mouth: 'M15 25q5 4 10 0' },
  { id: 'okay', label: 'Okay', eyes: 'M15 18h.01M25 18h.01', eyeWidth: 4, mouth: 'M15 26h10' },
  { id: 'low', label: 'Low', eyes: 'M15 18h.01M25 18h.01', eyeWidth: 4, mouth: 'M15 28q5-4 10 0' },
  { id: 'tired', label: 'Exhausted', eyes: 'M12.5 18q2.5 2 5 0M22.5 18q2.5 2 5 0', eyeWidth: 2.2, mouth: 'M15 27q2.5-2.5 5 0t5 0' },
];

export const moodById = (id: MoodId): MoodDef => MOODS.find((m) => m.id === id) ?? MOODS[1];

export const MoodFace = memo(function MoodFace({ mood, size = 40 }: { mood: MoodId; size?: number }) {
  const { mood: moodColors } = useTheme();
  const def = moodById(mood);
  const col = moodColors(mood);
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" accessibilityLabel={def.label}>
      <Circle cx={20} cy={20} r={19} fill={col.fill} />
      <Path d={def.eyes} fill="none" stroke={col.ink} strokeWidth={def.eyeWidth} strokeLinecap="round" />
      <Path d={def.mouth} fill="none" stroke={col.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
});
