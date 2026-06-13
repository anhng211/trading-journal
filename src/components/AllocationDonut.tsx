import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { Position, PriceCache } from '../types';
import { portfolioValue, priceOf } from '../lib/portfolio';
import { fmtMoney, fmtPct } from '../lib/format';

interface Slice {
  name: string;
  value: number;
  weight: number;
  color: string;
}

/**
 * Hero allocation ring — every holding (plus cash) as a slice of total
 * portfolio value, with a center total and a color-keyed breakdown list.
 */
export function AllocationDonut({
  positions,
  cash,
  prices,
  colorMap,
}: {
  positions: Position[];
  cash: number;
  prices: PriceCache;
  colorMap: Record<string, string>;
}) {
  const total = portfolioValue(positions, cash, prices);
  if (total <= 0) return null;

  const slices: Slice[] = positions
    .map((p) => {
      const value = p.shares * priceOf(p.ticker, prices, p.avgCost);
      return {
        name: p.ticker,
        value,
        weight: value / total,
        color: colorMap[p.ticker.toUpperCase()] ?? 'var(--accent)',
      };
    })
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);

  if (cash > 0.005) {
    slices.push({ name: 'Cash', value: cash, weight: cash / total, color: 'var(--neutral)' });
  }

  return (
    <div className="card">
      <h2>Portfolio allocation</h2>
      <div className="donut-wrap">
        <div className="donut-chart">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius={68}
                outerRadius={104}
                paddingAngle={slices.length > 1 ? 2 : 0}
                stroke="var(--card)"
                strokeWidth={2}
                startAngle={90}
                endAngle={-270}
              >
                {slices.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, _n, item) =>
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  [`${fmtMoney(Number(v ?? 0))} · ${fmtPct((item as any)?.payload?.weight ?? 0)}`, '']
                }
                contentStyle={{
                  background: 'var(--card)',
                  border: '1.5px solid var(--border-soft)',
                  borderRadius: 8,
                  fontWeight: 600,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center">
            <span className="donut-center-label">Total value</span>
            <span className="donut-center-value">{fmtMoney(total)}</span>
          </div>
        </div>

        <ul className="alloc-legend">
          {slices.map((s) => (
            <li key={s.name}>
              <span className="alloc-swatch" style={{ background: s.color }} />
              <span className="alloc-name">{s.name}</span>
              <span className="alloc-weight">{fmtPct(s.weight)}</span>
              <span className="alloc-value muted">{fmtMoney(s.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
