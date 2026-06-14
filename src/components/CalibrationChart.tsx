import { useMemo } from 'react';
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  ReferenceLine,
} from 'recharts';
import { useJournal } from '../store/journal';
import { decisionOutcome } from '../lib/portfolio';
import { fmtSignedPct } from '../lib/format';

/**
 * Confidence calibration: do your confidence-5 decisions actually beat
 * your confidence-2 ones? Each dot is a decision; y = return vs doing nothing.
 */
export function CalibrationChart() {
  const decisions = useJournal((s) => s.decisions);
  const trades = useJournal((s) => s.trades);
  const cashEvents = useJournal((s) => s.cashEvents);
  const settings = useJournal((s) => s.settings);
  const prices = useJournal((s) => s.prices);

  const data = useMemo(() => {
    if (Object.keys(prices).length === 0) return [];
    return decisions
      // The 'opening' baseline has an assigned (not predicted) confidence — exclude it.
      .filter((d) => d.kind !== 'opening')
      .map((d) => {
        const o = decisionOutcome(d, trades, cashEvents, settings, prices);
        return {
          confidence: d.confidence,
          pct: o.pct * 100,
          title: d.title,
          grade: d.review?.grade,
        };
      });
  }, [decisions, trades, cashEvents, settings, prices]);

  if (data.length < 2) return null;

  return (
    <div className="card">
      <h2>Confidence calibration</h2>
      <p className="muted">
        Each dot is a decision: confidence at the time (x) vs. outcome relative to doing
        nothing (y). If high-confidence dots aren't higher, your conviction isn't informative yet.
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <ScatterChart margin={{ top: 12, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-bg)" />
          <XAxis
            type="number"
            dataKey="confidence"
            name="Confidence"
            domain={[0.5, 5.5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fontSize: 12, fill: 'var(--muted)' }}
            label={{ value: 'Confidence', position: 'insideBottom', offset: -2, fontSize: 12, fill: 'var(--muted)' }}
          />
          <YAxis
            type="number"
            dataKey="pct"
            name="vs doing nothing"
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            tick={{ fontSize: 12, fill: 'var(--muted)' }}
            width={56}
          />
          <ZAxis range={[120, 120]} />
          <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="4 4" />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ background: 'var(--card)', border: '2px solid var(--ink)', borderRadius: 8, fontWeight: 700 }}
            formatter={(value, name) =>
              name === 'vs doing nothing' ? fmtSignedPct(Number(value ?? 0) / 100) : String(value ?? '')
            }
            labelFormatter={() => ''}
          />
          <Scatter data={data} fill="var(--accent)" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
