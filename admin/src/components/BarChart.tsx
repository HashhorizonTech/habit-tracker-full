import type { DayCount } from '../api/types';
import { formatDayKey, formatNumber } from '../lib/format';

interface BarChartProps {
  title: string;
  data: DayCount[];
  color: 'a1' | 'a2';
}

const W = 600;
const H = 180;
const PAD = { top: 12, right: 8, bottom: 24, left: 32 };

function niceMax(n: number): number {
  if (n <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(n));
  const steps = [1, 2, 2.5, 5, 10];
  for (const s of steps) if (s * pow >= n) return s * pow;
  return 10 * pow;
}

/** Hand-rolled SVG daily bar chart. */
export function BarChart({ title, data, color }: BarChartProps) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const max = niceMax(Math.max(0, ...data.map((d) => d.count)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = data.length ? innerW / data.length : innerW;
  const barW = Math.max(2, slot * 0.68);
  const ticks = [0, max / 2, max];
  const labelIdx = new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]);

  return (
    <figure className="card chart-card">
      <figcaption className="chart-head">
        <span className="card-label">{title}</span>
        <span className="chart-total">{formatNumber(total)} in 30 days</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart"
        role="img"
        aria-label={`${title}: ${formatNumber(total)} total over the last ${data.length} days`}
        preserveAspectRatio="none"
      >
        {ticks.map((t) => {
          const y = PAD.top + innerH - (t / max) * innerH;
          return (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} className="chart-grid" />
              <text x={PAD.left - 6} y={y + 4} className="chart-axis" textAnchor="end">
                {formatNumber(t)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.count / max) * innerH;
          const x = PAD.left + i * slot + (slot - barW) / 2;
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={PAD.top + innerH - h}
                width={barW}
                height={Math.max(h, d.count > 0 ? 1.5 : 0)}
                rx={Math.min(3, barW / 3)}
                className={`chart-bar chart-bar-${color}`}
              >
                <title>{`${formatDayKey(d.date)}: ${formatNumber(d.count)}`}</title>
              </rect>
              {labelIdx.has(i) && (
                <text
                  x={x + barW / 2}
                  y={H - 6}
                  className="chart-axis"
                  textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
                >
                  {formatDayKey(d.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
