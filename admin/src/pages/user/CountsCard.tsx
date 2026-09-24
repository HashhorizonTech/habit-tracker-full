import type { AdminUserDetail } from '../../api/types';
import { formatNumber } from '../../lib/format';

export function CountsCard({ counts, profile }: Pick<AdminUserDetail, 'counts' | 'profile'>) {
  const items: [string, number | string][] = [
    ['Habits', counts.habits],
    ['Check-ins', counts.habitLogs],
    ['Tasks', counts.tasks],
    ['Focus sessions', counts.focusSessions],
    ['Moods', counts.moodLogs],
    ['XP', profile ? profile.xp : '—'],
    ['Level', profile ? profile.level : '—'],
  ];
  return (
    <section className="card" aria-labelledby="counts-title">
      <h2 id="counts-title" className="card-label">
        Activity
      </h2>
      <dl className="counts-grid">
        {items.map(([label, value]) => (
          <div key={label} className="count">
            <dt>{label}</dt>
            <dd>{typeof value === 'number' ? formatNumber(value) : value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
