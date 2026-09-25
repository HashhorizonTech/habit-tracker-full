// Preset goals: ready-made habits with sensible defaults (presets screen, onboarding, Create habit chips).
import type { IconName } from '@/components/icons/paths';
import type { Category, Frequency, TimeOfDay } from '@/data/types';
import type { HabitInput } from '@/store/data';

/** Yes/No = done or not done (goal 1). Count = a number to reach each day. */
export type Tracking = 'check' | 'count';

export type PresetSection = 'Health' | 'Mind' | 'Growth' | 'Routine';

export interface Preset {
  id: string;
  name: string;
  /** Short line under the name, after the frequency ("Daily · 8 glasses"). */
  description: string;
  icon: IconName;
  /** One of HABIT_HUES. */
  hue: number;
  category: Category;
  section: PresetSection;
  tracking: Tracking;
  goal: number;
  unit: string;
  step: number;
  frequency: Frequency;
  timeOfDay: TimeOfDay;
  /** Saved as the habit's note. */
  note?: string;
}

export const PRESET_SECTIONS: readonly PresetSection[] = ['Health', 'Mind', 'Growth', 'Routine'];

const DAILY: Frequency = { type: 'daily' };
const WEEKDAYS: Frequency = { type: 'days', days: [true, true, true, true, true, false, false] };

export const PRESETS: readonly Preset[] = [
  // Health
  { id: 'water', name: 'Drink water', description: '8 glasses', icon: 'drop', hue: 230, category: 'Health', section: 'Health', tracking: 'count', goal: 8, unit: 'glasses', step: 1, frequency: DAILY, timeOfDay: 'Anytime' },
  { id: 'walk', name: 'Walk', description: '30 minutes on your feet', icon: 'target', hue: 120, category: 'Fitness', section: 'Health', tracking: 'count', goal: 30, unit: 'min', step: 5, frequency: DAILY, timeOfDay: 'Anytime', note: 'Tick it off yourself.' },
  { id: 'workout', name: 'Workout', description: 'Any movement counts', icon: 'flame', hue: 25, category: 'Fitness', section: 'Health', tracking: 'check', goal: 1, unit: 'times', step: 1, frequency: { type: 'weekly', times: 3 }, timeOfDay: 'Anytime' },
  { id: 'stretch', name: 'Stretch', description: '10 minutes', icon: 'dumbbell', hue: 200, category: 'Fitness', section: 'Health', tracking: 'count', goal: 10, unit: 'min', step: 5, frequency: DAILY, timeOfDay: 'Morning' },
  { id: 'fruit', name: 'Eat a fruit or veg', description: '3 a day', icon: 'heart', hue: 340, category: 'Health', section: 'Health', tracking: 'count', goal: 3, unit: 'times', step: 1, frequency: DAILY, timeOfDay: 'Anytime' },
  // Mind
  { id: 'meditate', name: 'Meditate', description: '10 minutes', icon: 'leaf', hue: 165, category: 'Health', section: 'Mind', tracking: 'count', goal: 10, unit: 'min', step: 5, frequency: DAILY, timeOfDay: 'Anytime' },
  { id: 'journal', name: 'Journal', description: 'One line is enough', icon: 'pen', hue: 60, category: 'Personal', section: 'Mind', tracking: 'check', goal: 1, unit: 'entry', step: 1, frequency: DAILY, timeOfDay: 'Evening' },
  { id: 'walk-outside', name: 'Walk outside', description: 'Fresh air, any length', icon: 'sun', hue: 120, category: 'Personal', section: 'Mind', tracking: 'check', goal: 1, unit: 'times', step: 1, frequency: DAILY, timeOfDay: 'Anytime' },
  { id: 'no-phone', name: 'No phone in bed', description: 'Leave it outside the bedroom', icon: 'moon', hue: 285, category: 'Evening', section: 'Mind', tracking: 'check', goal: 1, unit: 'times', step: 1, frequency: DAILY, timeOfDay: 'Evening' },
  // Growth
  { id: 'read', name: 'Read', description: '20 pages', icon: 'book', hue: 60, category: 'Learning', section: 'Growth', tracking: 'count', goal: 20, unit: 'pages', step: 5, frequency: DAILY, timeOfDay: 'Anytime' },
  { id: 'language', name: 'Learn a language', description: '15 minutes', icon: 'sparkle', hue: 285, category: 'Learning', section: 'Growth', tracking: 'count', goal: 15, unit: 'min', step: 5, frequency: DAILY, timeOfDay: 'Anytime' },
  { id: 'deep-work', name: 'Deep work', description: '60 minutes, no distractions', icon: 'code', hue: 200, category: 'Work', section: 'Growth', tracking: 'count', goal: 60, unit: 'min', step: 15, frequency: WEEKDAYS, timeOfDay: 'Morning' },
  { id: 'save', name: 'Save money', description: 'Put something aside', icon: 'shield', hue: 165, category: 'Personal', section: 'Growth', tracking: 'check', goal: 1, unit: 'times', step: 1, frequency: DAILY, timeOfDay: 'Anytime' },
  // Routine
  { id: 'sleep', name: 'Sleep 8 hours', description: 'In bed by 11', icon: 'clock', hue: 230, category: 'Evening', section: 'Routine', tracking: 'check', goal: 1, unit: 'times', step: 1, frequency: DAILY, timeOfDay: 'Evening' },
  { id: 'vitamins', name: 'Vitamins', description: 'With breakfast', icon: 'plus', hue: 25, category: 'Morning', section: 'Routine', tracking: 'check', goal: 1, unit: 'times', step: 1, frequency: DAILY, timeOfDay: 'Morning' },
  { id: 'plan', name: 'Plan tomorrow', description: 'Two minutes each evening', icon: 'bolt', hue: 285, category: 'Work', section: 'Routine', tracking: 'check', goal: 1, unit: 'times', step: 1, frequency: DAILY, timeOfDay: 'Evening' },
];

const BY_ID: Record<string, Preset> = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

export const presetById = (id: string): Preset | undefined => BY_ID[id];

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Short frequency label: "Daily", "Weekdays", "3× a week"… */
export function frequencyLabel(f: Frequency): string {
  switch (f.type) {
    case 'daily':
      return 'Daily';
    case 'days': {
      const d = f.days ?? [];
      if (d.length === 7 && d.slice(0, 5).every(Boolean) && !d[5] && !d[6]) return 'Weekdays';
      return DAY_SHORT.filter((_, i) => d[i]).join(' · ') || 'Some days';
    }
    case 'weekly':
      return `${f.times ?? 1}× a week`;
    case 'monthly':
      return `${f.times ?? 1}× a month`;
    case 'custom':
      return `Every ${f.every ?? 2} days`;
  }
}

/** "Daily · 8 glasses" */
export const presetSubtitle = (p: Preset) => `${frequencyLabel(p.frequency)} · ${p.description}`;

/** The habit a preset plants. */
export function presetToHabit(p: Preset): HabitInput {
  return {
    name: p.name,
    icon: p.icon,
    hue: p.hue,
    category: p.category,
    frequency: p.frequency.days ? { ...p.frequency, days: [...p.frequency.days] } : { ...p.frequency },
    goal: p.goal,
    unit: p.unit,
    step: p.step,
    timeOfDay: p.timeOfDay,
    reminder: null,
    notes: p.note ?? null,
  };
}

/** Case-insensitive names of habits already being grown. */
export const nameKey = (name: string) => name.trim().toLowerCase();
