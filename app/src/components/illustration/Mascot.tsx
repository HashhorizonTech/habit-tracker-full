// The Tend blob sprout (SPEC §2). Geometry is the prototype's 120×120 CSS drawing
// (design/Mascot.dc.html) translated to SVG; everything scales with `size`.
import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Mask,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { mix, useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';
import { useSvgId } from '@/lib/useSvgId';
import { useLoop } from './useLoop';

export type MascotFace = 'happy' | 'wow' | 'sleepy' | 'focus';
export type MascotAccessory = 'none' | 'star' | 'moon' | 'sun' | 'sparkle' | 'coffee';

export interface MascotProps {
  size?: number;
  face?: MascotFace;
  accessory?: MascotAccessory;
  float?: boolean;
}

const BOX = 120;
const FACE = '#1d1a2e';
// Body: left 20, top 28, 80×76, border-radius 50% 50% 46% 46% / 58% 58% 42% 42%.
const BODY =
  'M60 28 A40 44.08 0 0 1 100 72.08 A36.8 31.92 0 0 1 63.2 104 L56.8 104 A36.8 31.92 0 0 1 20 72.08 A40 44.08 0 0 1 60 28 Z';
const STAR5 = (x: number, y: number, s: number) => {
  const p = [
    [50, 0], [61, 35], [98, 35], [68, 57], [79, 91], [50, 70], [21, 91], [32, 57], [2, 35], [39, 35],
  ];
  return 'M' + p.map(([px, py]) => `${x + (px / 100) * s} ${y + (py / 100) * s}`).join(' L') + ' Z';
};
const STAR4 = (x: number, y: number, s: number) => {
  const p = [[50, 0], [62, 38], [100, 50], [62, 62], [50, 100], [38, 62], [0, 50], [38, 38]];
  return 'M' + p.map(([px, py]) => `${x + (px / 100) * s} ${y + (py / 100) * s}`).join(' L') + ' Z';
};

/** A small absolutely-positioned piece that twinkles (scale 1 → .72, opacity 1 → .6). */
function Twinkle({
  x, y, w, h, scale, period = 2400, delay = 0, children,
}: {
  x: number; y: number; w: number; h: number; scale: number;
  period?: number; delay?: number; children: ReactNode;
}) {
  const t = useLoop(period, { delay });
  const style = useAnimatedStyle(() => ({
    opacity: 1 - 0.4 * t.value,
    transform: [{ scale: 1 - 0.28 * t.value }],
  }));
  return (
    <Animated.View
      style={[{ position: 'absolute', left: x * scale, top: y * scale, width: w * scale, height: h * scale }, style]}
    >
      <Svg width="100%" height="100%" viewBox={`${x} ${y} ${w} ${h}`}>
        {children}
      </Svg>
    </Animated.View>
  );
}

function Face({ face }: { face: MascotFace }) {
  switch (face) {
    case 'wow':
      return (
        <G>
          <Ellipse cx={48} cy={63} rx={5} ry={6} fill={FACE} />
          <Ellipse cx={72} cy={63} rx={5} ry={6} fill={FACE} />
          <Circle cx={47} cy={61} r={2} fill="#fff" />
          <Circle cx={71} cy={61} r={2} fill="#fff" />
          <Ellipse cx={60} cy={77.5} rx={4} ry={4.5} fill={FACE} />
        </G>
      );
    case 'sleepy':
      return (
        <G stroke={FACE} strokeWidth={2.5} strokeLinecap="round" fill="none">
          <Path d="M43.25 61.5 Q47.5 68 51.75 61.5" />
          <Path d="M68.25 61.5 Q72.5 68 76.75 61.5" />
          <Rect x={57} y={74} width={6} height={3} rx={1.5} fill={FACE} stroke="none" />
        </G>
      );
    case 'focus':
      return (
        <G>
          <Rect x={43} y={63} width={10} height={2.5} rx={1.25} fill={FACE} />
          <Rect x={67} y={63} width={10} height={2.5} rx={1.25} fill={FACE} />
          <Path d="M57.25 71.5 Q60 76.5 62.75 71.5" stroke={FACE} strokeWidth={2.5} strokeLinecap="round" fill="none" />
        </G>
      );
    default:
      return (
        <G>
          <Ellipse cx={48.5} cy={63.5} rx={3.5} ry={4.5} fill={FACE} />
          <Ellipse cx={71.5} cy={63.5} rx={3.5} ry={4.5} fill={FACE} />
          <Path d="M55.25 72 Q60 79 64.75 72" stroke={FACE} strokeWidth={2.5} strokeLinecap="round" fill="none" />
        </G>
      );
  }
}

function Accessory({ kind, s }: { kind: MascotAccessory; s: number }) {
  const { c, fixed } = useTheme();
  const moonId = useSvgId('moon');
  switch (kind) {
    case 'star':
      return (
        <>
          <Twinkle x={92} y={8} w={22} h={22} scale={s}><Path d={STAR5(92, 8, 22)} fill={fixed.star} /></Twinkle>
          <Twinkle x={6} y={32} w={11} h={11} scale={s} delay={800}><Path d={STAR5(6, 32, 11)} fill={fixed.star} /></Twinkle>
        </>
      );
    case 'moon':
      return (
        <>
          <View style={[StyleSheet.absoluteFill]} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox={`0 0 ${BOX} ${BOX}`}>
              <Defs>
                <Mask id={moonId} x="0" y="0" width={BOX} height={BOX} maskUnits="userSpaceOnUse">
                  <Circle cx={24} cy={24} r={13} fill="#fff" />
                  <Circle cx={17} cy={19} r={13} fill="#000" />
                </Mask>
              </Defs>
              <Circle cx={24} cy={24} r={13} fill={fixed.moon} mask={`url(#${moonId})`} />
            </Svg>
          </View>
          <Twinkle x={92} y={10} w={14} h={18} scale={s} period={3000}>
            <SvgText x={94} y={26} fontSize={14} fontFamily={fonts.display700} fill={c.ink3}>z</SvgText>
          </Twinkle>
          <Twinkle x={102} y={0} w={11} h={13} scale={s} period={3000} delay={1000}>
            <SvgText x={104} y={10} fontSize={10} fontFamily={fonts.display700} fill={c.ink3}>z</SvgText>
          </Twinkle>
        </>
      );
    case 'sun':
      return (
        // The outer halo (r 26) spills past the 120 box, so this layer gets its own larger viewport.
        <View
          style={{ position: 'absolute', left: 75 * s, top: -11 * s, width: 52 * s, height: 52 * s }}
          pointerEvents="none"
        >
          <Svg width="100%" height="100%" viewBox="0 0 52 52">
            <Circle cx={26} cy={26} r={26} fill={fixed.sunHalo2} />
            <Circle cx={26} cy={26} r={19} fill={fixed.sunHalo1} />
            <Circle cx={26} cy={26} r={13} fill={fixed.sun} />
          </Svg>
        </View>
      );
    case 'sparkle':
      return (
        <>
          <Twinkle x={94} y={14} w={15} h={15} scale={s} period={2000}><Path d={STAR4(94, 14, 15)} fill={fixed.sparkle} /></Twinkle>
          <Twinkle x={10} y={22} w={10} h={10} scale={s} period={2000} delay={600}><Path d={STAR4(10, 22, 10)} fill={c.a2} /></Twinkle>
          <Twinkle x={104} y={62} w={9} h={9} scale={s} period={2000} delay={1100}><Path d={STAR4(104, 62, 9)} fill={fixed.sparkle} /></Twinkle>
        </>
      );
    case 'coffee':
      return (
        <>
          <Twinkle x={92} y={66} w={3} h={9} scale={s} period={2000}><Rect x={92} y={66} width={3} height={9} rx={1.5} fill={c.ink3} opacity={0.5} /></Twinkle>
          <Twinkle x={99} y={63} w={3} h={11} scale={s} period={2000} delay={500}><Rect x={99} y={63} width={3} height={11} rx={1.5} fill={c.ink3} opacity={0.5} /></Twinkle>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox={`0 0 ${BOX} ${BOX}`}>
              <Circle cx={109} cy={87} r={3.75} stroke={fixed.cup} strokeWidth={2.5} fill="none" />
              <Path d="M91 78 H106 A3 3 0 0 1 109 81 V87 A9 9 0 0 1 100 96 H97 A9 9 0 0 1 88 87 V81 A3 3 0 0 1 91 78 Z" fill={fixed.cup} />
            </Svg>
          </View>
        </>
      );
    default:
      return null;
  }
}

export const Mascot = memo(function Mascot({
  size = 120,
  face = 'happy',
  accessory = 'none',
  float = true,
}: MascotProps) {
  const { c, fixed } = useTheme();
  const s = size / BOX;
  const t = useLoop(4000, { enabled: float });
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * s * t.value }] }));
  const highlight = mix('#ffffff', c.a2, 0.45);
  const id = useSvgId('m');

  return (
    <View style={{ width: size, height: size, overflow: 'visible' }} accessibilityRole="image" accessibilityLabel="Tend mascot">
      {/* ground shadow */}
      <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${BOX} ${BOX}`}>
        <Defs>
          <RadialGradient id={`${id}Shadow`} cx="60" cy="110.5" rx="30" ry="6" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#000" stopOpacity={0.2} />
            <Stop offset="1" stopColor="#000" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${id}Glow`} cx="60" cy="96" rx="44" ry="18" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={c.a1} stopOpacity={0.35} />
            <Stop offset="1" stopColor={c.a1} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={60} cy={96} rx={44} ry={18} fill={`url(#${id}Glow)`} />
        <Ellipse cx={60} cy={110.5} rx={30} ry={6} fill={`url(#${id}Shadow)`} />
      </Svg>

      <Animated.View style={[StyleSheet.absoluteFill, floatStyle]}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${BOX} ${BOX}`}>
          <Defs>
            <RadialGradient id={`${id}Body`} cx="47.2" cy="49.3" r="76" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={highlight} />
              <Stop offset="0.38" stopColor={c.a2} />
              <Stop offset="0.88" stopColor={c.a1} />
            </RadialGradient>
            <Mask id={`${id}Inner`} x="0" y="0" width={BOX} height={BOX} maskUnits="userSpaceOnUse">
              <Path d={BODY} fill="#fff" />
              <Path d={BODY} fill="#000" transform="translate(-8 -10)" />
            </Mask>
          </Defs>
          {/* stem + leaf */}
          <Rect x={58.5} y={18} width={3} height={14} rx={1.5} fill={fixed.stem} />
          <Path d="M60 10 A18 12 0 0 1 78 22 A18 12 0 0 1 60 10 Z" fill={fixed.leaf} transform="rotate(-18 69 16)" />
          {/* body + soft inner shadow */}
          <Path d={BODY} fill={`url(#${id}Body)`} />
          <Rect x={0} y={0} width={BOX} height={BOX} fill="#000" opacity={0.07} mask={`url(#${id}Inner)`} />
          {/* blush */}
          <Ellipse cx={37.5} cy={76} rx={5.5} ry={3} fill={fixed.blush} />
          <Ellipse cx={82.5} cy={76} rx={5.5} ry={3} fill={fixed.blush} />
          <Face face={face} />
        </Svg>
      </Animated.View>

      <Accessory kind={accessory} s={s} />
    </View>
  );
});
