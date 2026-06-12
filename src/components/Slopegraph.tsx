import type { DiffRow } from '../lib/portfolio';
import { fmtPct } from '../lib/format';

const KIND_COLOR: Record<DiffRow['kind'], string> = {
  new: 'var(--gain)',
  increase: 'var(--gain)',
  decrease: 'var(--warn)',
  exit: 'var(--loss)',
  unchanged: 'var(--neutral)',
};

/**
 * Hand-rolled SVG slopegraph: each holding is a line from its "before"
 * weight (left) to its "after" weight (right). Crossings and steep slopes
 * make a rebalance readable at a glance.
 */
export function Slopegraph({
  rows,
  labels = ['Before', 'After'],
}: {
  rows: DiffRow[];
  labels?: [string, string];
}) {
  const visible = rows.filter((r) => r.weightBefore > 0.0005 || r.weightAfter > 0.0005);
  if (visible.length === 0) return null;

  const W = 640;
  const H = Math.max(220, visible.length * 34 + 60);
  const padTop = 36;
  const padBottom = 16;
  const leftX = 170;
  const rightX = W - 170;
  const maxW = Math.max(...visible.map((r) => Math.max(r.weightBefore, r.weightAfter)), 0.01);
  const y = (w: number) => padTop + (1 - w / maxW) * (H - padTop - padBottom);

  // Nudge overlapping end-labels apart so they stay legible.
  const spread = (items: { ticker: string; y: number }[]) => {
    const sorted = [...items].sort((a, b) => a.y - b.y);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].y - sorted[i - 1].y < 14) sorted[i].y = sorted[i - 1].y + 14;
    }
    return new Map(sorted.map((s) => [s.ticker, s.y]));
  };
  const leftLabels = spread(visible.map((r) => ({ ticker: r.ticker, y: y(r.weightBefore) })));
  const rightLabels = spread(visible.map((r) => ({ ticker: r.ticker, y: y(r.weightAfter) })));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Allocation slopegraph" style={{ width: '100%', height: 'auto' }}>
      <text x={leftX} y={20} textAnchor="end" fontSize="13" fontWeight="800" fill="var(--muted)">
        {labels[0]}
      </text>
      <text x={rightX} y={20} textAnchor="start" fontSize="13" fontWeight="800" fill="var(--muted)">
        {labels[1]}
      </text>
      <line x1={leftX} y1={padTop - 6} x2={leftX} y2={H - padBottom} stroke="var(--muted)" strokeWidth="1" opacity="0.4" />
      <line x1={rightX} y1={padTop - 6} x2={rightX} y2={H - padBottom} stroke="var(--muted)" strokeWidth="1" opacity="0.4" />

      {visible.map((r) => {
        const y1 = y(r.weightBefore);
        const y2 = y(r.weightAfter);
        const color = KIND_COLOR[r.kind];
        const ly1 = leftLabels.get(r.ticker) ?? y1;
        const ly2 = rightLabels.get(r.ticker) ?? y2;
        return (
          <g key={r.ticker}>
            <line x1={leftX} y1={y1} x2={rightX} y2={y2} stroke={color} strokeWidth="2.5" strokeDasharray={r.kind === 'unchanged' ? '4 4' : undefined} />
            <circle cx={leftX} cy={y1} r="4" fill={r.weightBefore > 0.0005 ? color : 'transparent'} />
            <circle cx={rightX} cy={y2} r="4" fill={r.weightAfter > 0.0005 ? color : 'transparent'} />
            <text x={leftX - 10} y={ly1 + 4} textAnchor="end" fontSize="12" fontWeight="700" fill="var(--text)">
              {r.ticker} {r.weightBefore > 0.0005 ? fmtPct(r.weightBefore, 0) : '—'}
            </text>
            <text x={rightX + 10} y={ly2 + 4} textAnchor="start" fontSize="12" fontWeight="700" fill="var(--text)">
              {r.weightAfter > 0.0005 ? fmtPct(r.weightAfter, 0) : '—'} {r.ticker}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
