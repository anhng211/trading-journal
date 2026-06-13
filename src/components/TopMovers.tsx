import type { Position, PriceCache } from '../types';
import { fmtSignedMoney, fmtSignedPct } from '../lib/format';

interface Mover {
  ticker: string;
  pct: number;
  pl: number;
}

/** Best/worst open positions by unrealized return — the dashboard "movers" panel. */
export function TopMovers({ positions, prices }: { positions: Position[]; prices: PriceCache }) {
  if (Object.keys(prices).length === 0) return null;

  const movers: Mover[] = positions
    .filter((p) => prices[p.ticker.toUpperCase()] != null && p.avgCost > 0)
    .map((p) => {
      const price = prices[p.ticker.toUpperCase()].price;
      return { ticker: p.ticker, pct: (price - p.avgCost) / p.avgCost, pl: (price - p.avgCost) * p.shares };
    });

  const gainers = movers.filter((m) => m.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 4);
  const losers = movers.filter((m) => m.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 4);
  if (gainers.length === 0 && losers.length === 0) return null;

  const list = (rows: Mover[], kind: 'gain' | 'loss') => (
    <ul className="movers-list">
      {rows.length === 0 ? (
        <li className="muted">None</li>
      ) : (
        rows.map((m) => (
          <li key={m.ticker}>
            <span className="mover-ticker">{m.ticker}</span>
            <span className={`pill ${kind}`}>{fmtSignedPct(m.pct)}</span>
            <span className={`mover-pl ${kind === 'gain' ? 'delta-gain' : 'delta-loss'}`}>
              {fmtSignedMoney(m.pl)}
            </span>
          </li>
        ))
      )}
    </ul>
  );

  return (
    <div className="card">
      <h2>Top movers</h2>
      <div className="grid2">
        <div>
          <h3>Gainers</h3>
          {list(gainers, 'gain')}
        </div>
        <div>
          <h3>Losers</h3>
          {list(losers, 'loss')}
        </div>
      </div>
      <p className="hint">By unrealized return on open positions, at current prices.</p>
    </div>
  );
}
