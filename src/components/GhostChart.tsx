import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { GhostPoint } from '../lib/portfolio';
import { fmtDate, fmtMoney } from '../lib/format';

/**
 * The counterfactual chart: "what you did" vs "if you'd done nothing".
 * The gap between the lines is the dollar value of the decision.
 */
export function GhostChart({ points }: { points: GhostPoint[] }) {
  if (points.length < 2) {
    return (
      <p className="hint">
        Not enough price history yet — refresh prices (or enter them manually) over the
        coming days and the two lines will grow from the decision date.
      </p>
    );
  }

  const data = points.map((p) => ({
    ...p,
    label: fmtDate(p.t),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-bg)" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--muted)' }} />
        <YAxis
          tickFormatter={(v: number) => fmtMoney(v)}
          tick={{ fontSize: 12, fill: 'var(--muted)' }}
          width={80}
          domain={['auto', 'auto']}
        />
        <Tooltip
          formatter={(v) => fmtMoney(Number(v ?? 0))}
          contentStyle={{
            background: 'var(--card)',
            border: '2px solid var(--ink)',
            borderRadius: 8,
            fontWeight: 700,
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="acted"
          name="What you did"
          stroke="var(--accent)"
          strokeWidth={3}
          dot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="ghost"
          name="If you'd done nothing"
          stroke="var(--neutral)"
          strokeWidth={2.5}
          strokeDasharray="6 5"
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
