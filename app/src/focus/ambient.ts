import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import type { Ambient } from '@/store/prefs';

const SOURCES: Record<Exclude<Ambient, 'Off'>, number> = {
  Rain: require('../../assets/sounds/ambient-rain.wav'),
  'Café': require('../../assets/sounds/ambient-cafe.wav'),
  Forest: require('../../assets/sounds/ambient-forest.wav'),
  'Brown noise': require('../../assets/sounds/ambient-brown.wav'),
};

let player: AudioPlayer | null = null;
let current: Ambient = 'Off';

/** Loop the chosen ambient sound during focus; 'Off' stops it. */
export function setAmbient(kind: Ambient) {
  if (kind === current) {
    if (player && !player.playing && kind !== 'Off') player.play();
    return;
  }
  stopAmbient();
  current = kind;
  if (kind === 'Off') return;
  try {
    player = createAudioPlayer(SOURCES[kind]);
    player.loop = true;
    player.volume = 0.45;
    player.play();
  } catch {
    player = null;
  }
}

export function stopAmbient() {
  current = 'Off';
  if (!player) return;
  try {
    player.pause();
    player.remove();
  } catch {
    // already released
  }
  player = null;
}
