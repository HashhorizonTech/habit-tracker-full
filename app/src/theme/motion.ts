// Motion spec — SPEC §5. Every animation in the app should pull timings from here.
import { Easing, withTiming, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

export const easing = {
  /** Main easing, cubic-bezier(.2,.8,.2,1). */
  out: Easing.bezier(0.2, 0.8, 0.2, 1),
  /** Sheet enter, cubic-bezier(.2,.9,.25,1). */
  sheet: Easing.bezier(0.2, 0.9, 0.25, 1),
  /** Sheet / modal exit. */
  exit: Easing.bezier(0.4, 0, 1, 1),
  /** Overshoot, cubic-bezier(.34,1.6,.5,1). */
  overshoot: Easing.bezier(0.34, 1.6, 0.5, 1),
  /** Stronger overshoot (~1.7) for the habit-complete fill. */
  overshootStrong: Easing.bezier(0.34, 1.8, 0.5, 1),
  inOut: Easing.inOut(Easing.ease),
  linear: Easing.linear,
} as const;

export const duration = {
  press: 150,
  pageEnter: 400,
  sheetIn: 420,
  sheetOut: 240,
  backdrop: 300,
  modal: 500,
  progress: 750,
  checkDraw: 350,
  checkDelay: 150,
  burst: 650,
  bigBurst: 1200,
  chartStagger: 40,
  chartStaggerDense: 12,
  lineReveal: 1200,
  flame: 1600,
  float: 4000,
  twinkle: 2400,
  breath: 4500,
  timerTick: 1000,
  theme: 450,
  toast: 2400,
  calmFade: 600,
  taskLinger: 650,
} as const;

export const spring = {
  /** Tab indicator: damping ~14 with visible overshoot. */
  tab: { damping: 14, stiffness: 180, mass: 1 } satisfies WithSpringConfig,
  /** Icon / check pop. */
  pop: { damping: 10, stiffness: 260, mass: 0.8 } satisfies WithSpringConfig,
  /** Toggle knob. */
  knob: { damping: 16, stiffness: 320, mass: 0.8 } satisfies WithSpringConfig,
  /** Soft settle for sheets dragged by hand. */
  settle: { damping: 22, stiffness: 220, mass: 1 } satisfies WithSpringConfig,
} as const;

export const pressScale = { default: 0.96, icon: 0.9 } as const;

/**
 * `withTiming` that jumps straight to the target under Reduce Motion. Android's
 * "Remove animations" can leave in-flight timings unfinished, so state changes that
 * must land (fading chrome away, hiding the tab bar) never depend on an animation.
 */
export function settle(target: number, config: WithTimingConfig, reduceMotion: boolean) {
  'worklet';
  return reduceMotion ? target : withTiming(target, config);
}
