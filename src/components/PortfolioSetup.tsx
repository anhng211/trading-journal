import { useState } from 'react';
import { useJournal, type HoldingInput } from '../store/journal';
import { navigate } from '../lib/route';

interface HoldingRow extends HoldingInput {
  key: string;
}

const blankRow = (): HoldingRow => ({
  key: crypto.randomUUID(),
  ticker: '',
  shares: 0,
  avgCost: 0,
  purchaseDate: '',
});

export function PortfolioSetup() {
  const addOpeningPortfolio = useJournal((s) => s.addOpeningPortfolio);
  const setSettings = useJournal((s) => s.setSettings);
  const settings = useJournal((s) => s.settings);

  const [rows, setRows] = useState<HoldingRow[]>([blankRow(), blankRow()]);
  const [cash, setCash] = useState('');
  const [benchmark, setBenchmark] = useState(settings.benchmarkTicker || 'SPY');
  const [error, setError] = useState('');

  const update = (key: string, patch: Partial<HoldingRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const submit = () => {
    const valid = rows.filter((r) => r.ticker.trim() && r.shares > 0 && r.avgCost > 0);
    if (valid.length === 0) {
      return setError('Add at least one holding with ticker, shares, and average cost.');
    }
    const freeFunds = Number(cash);
    setSettings({ benchmarkTicker: benchmark.trim().toUpperCase() || undefined });
    addOpeningPortfolio(
      valid.map(({ key: _key, ...h }) => ({ ...h, ticker: h.ticker.toUpperCase() })),
      Number.isFinite(freeFunds) && freeFunds >= 0 ? freeFunds : 0,
    );
    navigate('/');
  };

  return (
    <div className="card">
      <h2>Set up your portfolio</h2>
      <p className="muted">
        Start by entering what you already hold — no thesis needed. We’ll turn it into your{' '}
        <strong>opening portfolio</strong>, then you log decisions as you make them. Add an
        average cost so profit/loss works right away.
      </p>

      {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}

      <h3>Current holdings</h3>
      {rows.map((r) => (
        <div className="trade-row-grid" key={r.key}>
          <div>
            <label>Ticker</label>
            <input
              value={r.ticker}
              onChange={(e) => update(r.key, { ticker: e.target.value.toUpperCase() })}
              placeholder="AAPL"
            />
          </div>
          <div>
            <label>Shares</label>
            <input type="number" min={0} step="any" value={r.shares || ''}
              onChange={(e) => update(r.key, { shares: Number(e.target.value) })} />
          </div>
          <div>
            <label>Avg cost $</label>
            <input type="number" min={0} step="any" value={r.avgCost || ''}
              onChange={(e) => update(r.key, { avgCost: Number(e.target.value) })} />
          </div>
          <div>
            <label>Purchase date</label>
            <input type="date" value={r.purchaseDate || ''}
              onChange={(e) => update(r.key, { purchaseDate: e.target.value })} />
          </div>
          <button
            className="small danger"
            onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
            disabled={rows.length === 1}
            aria-label={`Remove ${r.ticker || 'holding'}`}
          >
            ✕
          </button>
        </div>
      ))}
      <button className="small" onClick={() => setRows((rs) => [...rs, blankRow()])}>
        + Add holding
      </button>

      <div className="grid2" style={{ marginTop: 8 }}>
        <div>
          <label htmlFor="setup-cash">Free funds / cash ($)</label>
          <input id="setup-cash" type="number" min={0} step="any" value={cash}
            onChange={(e) => setCash(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label htmlFor="setup-bench">Benchmark to compare against</label>
          <select id="setup-bench" value={benchmark} onChange={(e) => setBenchmark(e.target.value)}>
            <option value="SPY">S&P 500 (SPY)</option>
            <option value="VOO">S&P 500 (VOO)</option>
            <option value="QQQ">Nasdaq 100 (QQQ)</option>
          </select>
        </div>
      </div>
      <p className="hint">
        The benchmark line on your equity curve builds up from when you start refreshing prices
        (the free price tier has no historical backfill).
      </p>

      <div style={{ marginTop: 18 }}>
        <button className="primary" onClick={submit}>Create my portfolio</button>
      </div>
    </div>
  );
}
