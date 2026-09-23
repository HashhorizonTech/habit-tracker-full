// Prints the numbers the demo data produces, to compare with the design.
import { buildDemo } from '../src/data/demo';
import { completionRate, dayPercent, habitLongest, habitStreak, liveHabits, overallStreak, totalCompletions } from '../src/data/selectors';
import { levelInfo } from '../src/lib/xp';

const d = buildDemo('2026-09-23');
const hs = liveHabits(d.habits);
const rest = d.profile.streakProtection.restDays;
const o = overallStreak(hs, d.habitLogs, { restDays: rest, today: '2026-09-23' });
console.log('overall current', o.current, 'longest', o.longest, 'runs', o.runs.map((r) => `${r.start.slice(5)}:${r.length}`).join(' '));
for (const h of hs) {
  console.log(h.name.padEnd(12), 'streak', habitStreak(h, d.habitLogs, { restDays: rest, today: '2026-09-23' }), 'best', habitLongest(h, d.habitLogs, { restDays: rest, today: '2026-09-23' }), 'rate', completionRate(h, d.habitLogs, '2026-09-23'), 'total', totalCompletions(h, d.habitLogs));
}
console.log('day %', dayPercent(hs, d.habitLogs, Object.values(d.tasks), '2026-09-23'), 'level', levelInfo(d.profile.xp));
