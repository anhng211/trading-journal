import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useJournal } from '../store/journal';
import {
  benchmarkSeries,
  costBasis,
  decisionOutcome,
  portfolioValue,
  priceOf,
  replayLedger,
} from '../lib/portfolio';
import {
  fmtDate,
  fmtMoney,
  fmtMoneyExact,
  fmtShares,
  fmtSignedMoney,
  fmtSignedPct,
} from '../lib/format';
import { buildColorMap } from '../lib/palette';
import { AllocationDonut } from './AllocationDonut';
import { TopMovers } from './TopMovers';
import { CalibrationChart } from './CalibrationChart';
import { FundsCard } from './FundsCard';
import { makeDemoData } from '../lib/demo';
import { navigate } from '../lib/route';

export function Dashboard() {
  const trades = useJournal((s) => s.trades);
  const decisions = useJournal((s) => s.decisions);
  const cashEvents = useJournal((s) => s.cashEvents);
  const settings = useJournal((s) => s.settings);
  const prices = useJournal((s) => s.prices);
  const priceSnapshots = useJournal((s) => s.priceSnapshots);
  const refreshing = useJournal((s) => s.refreshing);
  const refreshError = useJournal((s) => s.refreshError);
  const refreshPrices = useJournal((s) => s.refreshPrices);
  const setManualPrice = useJournal((s) => s.setManualPrice);
  const loadData = useJournal((s) => s.loadData);

  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState('');

  const ledger = useMemo(
    () => replayLedger(trades, cashEvents, settings.startingCash),
    [trades, cashEvents, settings.startingCash],
  );
  const hasPrices = Object.keys(prices).length > 0;

  // Stable ticker→color map, ordered by current value, shared by the donut and
  // the holdings swatches so colors mean the same thing everywhere.
  const colorMap = useMemo(() => {
    const ordered = [...ledger.positions]
      .map((p) => ({ ticker: p.ticker, value: p.shares * priceOf(p.ticker, prices, p.avgCost) }))
      .sort((a, b) => b.value - a.value)
      .map((x) => x.ticker);
    return buildColorMap(ordered);
  }, [ledger.positions, prices]);

  // Trading 212-style account figures.
  const invested = costBasis(ledger.positions);
  const positionsValue = portfolioValue(ledger.positions, 0, prices);
  const value = positionsValue + ledger.cash;
  const unrealized = positionsValue - invested;
  const totalReturn = value - ledger.netDeposits;
  const totalReturnPct = ledger.netDeposits > 0 ? totalReturn / ledger.netDeposits : 0;

  // Skill metrics exclude the synthetic 'opening' baseline (its confidence is
  // assigned, not predicted, and its holdings weren't a journaled call).
  const judgedDecisions = useMemo(
    () => decisions.filter((d) => d.kind !== 'opening'),
    [decisions],
  );

  const totalAlpha = useMemo(() => {
    if (!hasPrices) return null;
    return judgedDecisions.reduce(
      (sum, d) => sum + decisionOutcome(d, trades, cashEvents, settings, prices).delta,
      0,
    );
  }, [judgedDecisions, trades, cashEvents, settings, prices, hasPrices]);

  const curve = useMemo(() => {
    const bench = benchmarkSeries(
      cashEvents,
      settings.startingCash,
      priceSnapshots,
      settings.benchmarkTicker,
    );
    const benchByT = new Map(bench.map((b) => [b.t, b.value]));
    return priceSnapshots.map((snap) => {
      const state = replayLedger(trades, cashEvents, settings.startingCash, snap.t, true);
      return {
        t: snap.t,
        label: fmtDate(snap.t),
        value: portfolioValue(state.positions, state.cash, snap.prices),
        benchmark: benchByT.get(snap.t),
      };
    });
  }, [priceSnapshots, trades, cashEvents, settings.startingCash, settings.benchmarkTicker]);

  const hasBenchmark = curve.some((p) => p.benchmark != null);
  const onlyOpening =
    decisions.length > 0 && decisions.every((d) => d.kind === 'opening');

  if (trades.length === 0 && cashEvents.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <div className="big">📈</div>
          <p>Start by adding the holdings you already own — then journal your decisions from there.</p>
          <div className="row" style={{ marginTop: 16, justifyContent: 'center' }}>
            <a className="btn primary" href="#/setup">Set up your portfolio</a>
            <button onClick={() => { loadData(makeDemoData()); navigate('/'); }}>
              Load demo data
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="stat-grid">
        <div className="stat">
          <div className="label">Portfolio value</div>
          <div className="value">{fmtMoney(value)}</div>
        </div>
        <div className="stat">
          <div className="label">Free funds</div>
          <div className="value">{fmtMoney(ledger.cash)}</div>
        </div>
        <div className="stat">
          <div className="label">Invested</div>
          <div className="value">{fmtMoney(invested)}</div>
        </div>
        <div className="stat">
          <div className="label">Unrealized P/L</div>
          <div className={`value ${unrealized >= 0 ? 'delta-gain' : 'delta-loss'}`}>
            {hasPrices ? fmtSignedMoney(unrealized) : '—'}
          </div>
        </div>
        <div className="stat">
          <div className="label">Realized P/L</div>
          <div className={`value ${ledger.realizedTotal >= 0 ? 'delta-gain' : 'delta-loss'}`}>
            {fmtSignedMoney(ledger.realizedTotal)}
          </div>
        </div>
        <div className="stat">
          <div className="label">Total return · on {fmtMoney(ledger.netDeposits)} in</div>
          <div className={`value ${totalReturn >= 0 ? 'delta-gain' : 'delta-loss'}`}>
            {hasPrices ? `${fmtSignedMoney(totalReturn)} (${fmtSignedPct(totalReturnPct)})` : '—'}
          </div>
        </div>
        {totalAlpha != null && (
          <div className="stat">
            <div className="label">All decisions vs doing nothing</div>
            <div className={`value ${totalAlpha >= 0 ? 'delta-gain' : 'delta-loss'}`}>
              {fmtSignedMoney(totalAlpha)}
            </div>
          </div>
        )}
      </div>

      {refreshError && <div className="error-banner">{refreshError}</div>}

      {onlyOpening && (
        <div className="card nudge">
          <span>✅ Portfolio set up. Now log decisions as you make them — that’s where the comparison magic happens.</span>
          <a className="btn primary small" href="#/new">+ Log a decision</a>
        </div>
      )}

      {ledger.positions.length > 0 && (
        <AllocationDonut
          positions={ledger.positions}
          cash={ledger.cash}
          prices={prices}
          colorMap={colorMap}
        />
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <h2>Equity curve</h2>
          <button className="small" onClick={() => void refreshPrices()} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : '↻ Refresh prices'}
          </button>
        </div>
        {curve.length >= 2 ? (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={curve} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                <defs>
                  <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                  contentStyle={{ background: 'var(--card)', border: '1.5px solid var(--border-soft)', borderRadius: 8, fontWeight: 600 }}
                />
                {decisions.map((d) => {
                  const after = curve.find((p) => p.t >= d.datetime);
                  return after ? (
                    <ReferenceLine
                      key={d.id}
                      x={after.label}
                      stroke="var(--warn)"
                      strokeDasharray="4 4"
                      label={{ value: '◆', position: 'top', fill: 'var(--warn)' }}
                    />
                  ) : null;
                })}
                {hasBenchmark && (
                  <Area
                    type="monotone"
                    dataKey="benchmark"
                    name={settings.benchmarkTicker || 'Benchmark'}
                    stroke="var(--muted)"
                    strokeWidth={2}
                    strokeDasharray="6 5"
                    fill="none"
                    dot={false}
                    connectNulls
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Portfolio"
                  stroke="var(--accent)"
                  strokeWidth={2.5}
                  fill="url(#equityFill)"
                  dot={{ r: 2.5 }}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
            <p className="hint">
              ◆ markers are decisions — open one from the Decisions tab to see its diff.
              {hasBenchmark && ` Dashed line = ${settings.benchmarkTicker} (same money in the index).`}
            </p>
          </>
        ) : (
          <p className="hint">
            The equity curve grows each time prices are refreshed. Refresh now (Finnhub key in
            Settings) or click a price below to enter it manually.
          </p>
        )}
      </div>

      <TopMovers positions={ledger.positions} prices={prices} />

      <div className="card">
        <h2>Holdings</h2>
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th className="num">Shares</th>
              <th className="num">Avg cost</th>
              <th className="num">Price</th>
              <th className="num">Value</th>
              <th className="num">P/L</th>
            </tr>
          </thead>
          <tbody>
            {ledger.positions.map((p) => {
              const price = priceOf(p.ticker, prices, p.avgCost);
              const known = prices[p.ticker] != null;
              const pl = (price - p.avgCost) * p.shares;
              return (
                <tr key={p.ticker}>
                  <td>
                    <span
                      className="ticker-dot"
                      style={{ background: colorMap[p.ticker.toUpperCase()] ?? 'var(--accent)' }}
                    />
                    <strong>{p.ticker}</strong>
                  </td>
                  <td className="num">{fmtShares(p.shares)}</td>
                  <td className="num">{fmtMoneyExact(p.avgCost)}</td>
                  <td className="num">
                    {editingPrice === p.ticker ? (
                      <input
                        type="number"
                        step="any"
                        autoFocus
                        value={priceDraft}
                        style={{ width: 110, padding: '4px 8px' }}
                        onChange={(e) => setPriceDraft(e.target.value)}
                        onBlur={() => {
                          const v = Number(priceDraft);
                          if (v > 0) setManualPrice(p.ticker, v);
                          setEditingPrice(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditingPrice(null);
                        }}
                      />
                    ) : (
                      <button
                        className="small"
                        title="Click to edit price manually"
                        onClick={() => {
                          setEditingPrice(p.ticker);
                          setPriceDraft(known ? String(price) : '');
                        }}
                      >
                        {known ? fmtMoneyExact(price) : 'set price'}
                      </button>
                    )}
                  </td>
                  <td className="num">{fmtMoney(p.shares * price)}</td>
                  <td className={`num ${pl >= 0 ? 'delta-gain' : 'delta-loss'}`}>
                    {known ? fmtSignedMoney(pl) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="hint">Click a price to override it manually — useful offline or without an API key.</p>
      </div>

      <FundsCard />

      <CalibrationChart />
    </div>
  );
}
