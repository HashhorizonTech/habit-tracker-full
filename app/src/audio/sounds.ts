import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { usePrefs } from '@/store/prefs';

const SOURCES = {
  tick: require('../../assets/sounds/tick.wav'),
  complete: require('../../assets/sounds/complete.wav'),
  undo: require('../../assets/sounds/undo.wav'),
  pop: require('../../assets/sounds/pop.wav'),
  mood: require('../../assets/sounds/mood.wav'),
  focusStart: require('../../assets/sounds/focus-start.wav'),
  focusBell: require('../../assets/sounds/focus-bell.wav'),
  breakOver: require('../../assets/sounds/break-over.wav'),
  achievement: require('../../assets/sounds/achievement.wav'),
  perfectDay: require('../../assets/sounds/perfect-day.wav'),
  levelUp: require('../../assets/sounds/level-up.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

const VOLUME: Partial<Record<SoundName, number>> = { tick: 0.6, undo: 0.5, pop: 0.7 };
// Rapid-fire sounds get two players so quick taps don't cut each other off.
const POOL: Partial<Record<SoundName, number>> = { tick: 2, pop: 2 };

const players = new Map<SoundName, AudioPlayer[]>();
const cursor = new Map<SoundName, number>();
let ready = false;

/** Preload every UI sound once at startup. Safe to call more than once. */
export async function initSounds() {
  if (ready) return;
  ready = true;
  try {
    // Mix with other apps' audio and stay quiet when the phone is on silent.
    await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
  } catch {
    // Audio mode is best-effort; sounds still play with defaults.
  }
  for (const name of Object.keys(SOURCES) as SoundName[]) {
    const list: AudioPlayer[] = [];
    for (let i = 0; i < (POOL[name] ?? 1); i++) {
      const p = createAudioPlayer(SOURCES[name]);
      p.volume = VOLUME[name] ?? 0.9;
      list.push(p);
    }
    players.set(name, list);
  }
}

/** Play a UI sound if "Completion sounds" is on. Never throws. */
export function playSound(name: SoundName) {
  if (!usePrefs.getState().sound) return;
  const list = players.get(name);
  if (!list?.length) return;
  const i = ((cursor.get(name) ?? -1) + 1) % list.length;
  cursor.set(name, i);
  try {
    const p = list[i];
    p.seekTo(0);
    p.play();
  } catch {
    // A failed sound should never break the interaction.
  }
}
