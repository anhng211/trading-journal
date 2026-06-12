import type { DiffRow } from '../lib/portfolio';
import { fmtPct, fmtShares } from '../lib/format';

const KIND_LABEL: Record<DiffRow['kind'], { label: string; cls: string }> = {
  new: { label: '+ NEW', cls: 'gain' },
  exit: { label: '− EXIT', cls: 'loss' },
  increase: { label: '▲ ADD', cls: 'gain' },
  decrease: { label: '▼ TRIM', cls: 'warn' },
  unchanged: { label: '= HELD', cls: 'neutral' },
};

export function DiffTable({ rows }: { rows: DiffRow[] }) {
  if (rows.length === 0) {
    return <p className="muted">No positions on either side.</p>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Ticker</th>
          <th>Change</th>
          <th className="num">Shares</th>
          <th className="num">Weight before</th>
          <th className="num">Weight after</th>
          <th className="num">Δ weight</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const dw = r.weightAfter - r.weightBefore;
          const k = KIND_LABEL[r.kind];
          return (
            <tr key={r.ticker}>
              <td><strong>{r.ticker}</strong></td>
              <td><span className={`pill ${k.cls}`}>{k.label}</span></td>
              <td className="num">
                {fmtShares(r.sharesBefore)} → {fmtShares(r.sharesAfter)}
              </td>
              <td className="num">{fmtPct(r.weightBefore)}</td>
              <td className="num">{fmtPct(r.weightAfter)}</td>
              <td className={`num ${dw > 0.0005 ? 'delta-gain' : dw < -0.0005 ? 'delta-loss' : 'delta-neutral'}`}>
                {dw >= 0 ? '+' : ''}{fmtPct(dw)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
