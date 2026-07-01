import { useMemo } from 'react';
import { useJournal } from '../store/journal';
import { replayLedger } from '../lib/portfolio';
import {
  assetMix,
  concentration,
  intervalReturns,
  isEtf,
  riskStats,
  sectorBreakdown,
  MIN_OBS,
  SECTOR_OPTIONS,
} from '../lib/analytics';
import { buildColorMap, colorForIndex } from '../lib/palette';
import { fmtMoney, fmtPct, fmtSignedPct } from '../lib/format';

const fmtRatio = (v: number | null, digits = 2): string => (v == null ? '—' : v.toFixed(digits));

export function XRay() {
  const trades = useJournal((s) => s.trades);
  const cashEvents = useJournal((s) => s.cashEvents);
  const settings = useJournal((s) => s.settings);
  const prices = useJournal((s) => s.prices);
  const priceSnapshots = useJournal((s) => s.priceSnapshots);
  const tickerMeta = useJournal((s) => s.tickerMeta);
  const setTickerMeta = useJournal((s) => s.setTickerMeta);
  const setSettings = useJournal((s) => s.setSettings);

  const benchmark = settings.benchmarkTicker?.toUpperCase() ?? 'SPY';
  const rf = settings.riskFreeRate ?? 4;

  const derived = useMemo(() => {
    const ledger = replayLedger(trades, cashEvents, settings.startingCash);
    const intervals = intervalReturns(
      trades,
      cashEvents,
      settings.startingCash,
      priceSnapshots,
      benchmark,
    );
    return {
      ledger,
      stats: riskStats(intervals, rf),
      intervals,
      conc: concentration(ledger.positions, prices),
      mix: assetMix(ledger.positions, ledger.cash, prices, tickerMeta),
      sectors: sectorBreakdown(ledger.positions, prices, tickerMeta),
      colorMap: buildColorMap(
        [...ledger.positions]
          .sort((a, b) => b.shares * b.avgCost - a.shares * a.avgCost)
          .map((p) => p.ticker),
      ),
    };
  }, [trades, cashEvents, settings.startingCash, priceSnapshots, benchmark, rf, prices, tickerMeta]);

  const { ledger, stats, conc, mix, sectors, colorMap } = derived;

  if (trades.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <div className="big">🩻</div>
          <p>X-Ray needs a portfolio first. Set up your holdings, then come back.</p>
          <p style={{ marginTop: 12 }}>
            <a className="btn primary" href="#/setup">Set up your portfolio</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <h2>Risk statistics — vs {benchmark}</h2>
          <span className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Risk-free
            <input
              type="number"
              step="0.1"
              min={0}
              value={rf}
              aria-label="Risk-free rate (annual %)"
              style={{ width: 64, padding: '3px 8px' }}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v >= 0) setSettings({ riskFreeRate: v });
              }}
            />
            %/yr
          </span>
        </div>

        {stats ? (
          <>
            <div className="stat-grid" style={{ marginTop: 12 }}>
              <div className="stat">
                <div className="label">Sharpe ratio</div>
                <div className="value">{fmtRatio(stats.sharpe)}</div>
                <div className="muted">return per unit of risk</div>
              </div>
              <div className="stat">
                <div className="label">Beta</div>
                <div className="value">{fmtRatio(stats.beta)}</div>
                <div className="muted">sensitivity to {benchmark}</div>
              </div>
              <div className="stat">
                <div className="label">Alpha (ann.)</div>
                <div className={`value ${stats.alpha != null && stats.alpha >= 0 ? 'delta-gain' : 'delta-loss'}`}>
                  {stats.alpha == null ? '—' : fmtSignedPct(stats.alpha)}
                </div>
                <div className="muted">excess vs CAPM</div>
              </div>
              <div className="stat">
                <div className="label">Volatility (ann.)</div>
                <div className="value">{stats.annVol == null ? '—' : fmtPct(stats.annVol)}</div>
                <div className="muted">std dev of returns</div>
              </div>
              <div className="stat">
                <div className="label">Max drawdown</div>
                <div className={`value ${stats.maxDrawdown < -0.0005 ? 'delta-loss' : 'delta-neutral'}`}>
                  {fmtPct(stats.maxDrawdown)}
                </div>
                <div className="muted">worst peak-to-trough</div>
              </div>
              <div className="stat">
                <div className="label">R²</div>
                <div className="value">{stats.r2 == null ? '—' : fmtPct(stats.r2, 0)}</div>
                <div className="muted">explained by {benchmark}</div>
              </div>
              <div className="stat">
                <div className="label">Return (ann.)</div>
                <div className={`value ${stats.annReturn >= 0 ? 'delta-gain' : 'delta-loss'}`}>
                  {fmtSignedPct(stats.annReturn)}
                </div>
                <div className="muted">
                  {stats.benchAnnReturn == null ? 'time-weighted' : `${benchmark}: ${fmtSignedPct(stats.benchAnnReturn)}`}
                </div>
              </div>
            </div>
            <p className="hint">
              Based on {stats.n} observations over {stats.spanDays} days
              {stats.pairedN < stats.n ? ` (${stats.pairedN} paired with ${benchmark})` : ''}.
              {stats.lowConfidence ? ' Early estimate — statistics firm up as price history grows.' : ''}
              {' '}Deposits/withdrawals are excluded from returns (time-weighted).
            </p>
          </>
        ) : (
          <p className="hint" style={{ marginTop: 10 }}>
            Not enough history yet: risk statistics need at least {MIN_OBS + 1} price snapshots
            (you have {priceSnapshots.length}). Each “Refresh prices” on the Dashboard adds one —
            refresh on different days and Sharpe, Beta &amp; co. will appear here automatically.
          </p>
        )}
      </div>

      {conc && (
        <div className="card">
          <h2>Concentration</h2>
          <div className="stat-grid" style={{ marginTop: 12 }}>
            <div className="stat">
              <div className="label">Positions</div>
              <div className="value">{conc.count}</div>
            </div>
            <div className="stat">
              <div className="label">Effective holdings</div>
              <div className="value">{conc.effectiveN.toFixed(1)}</div>
              <div className="muted">diversification-adjusted</div>
            </div>
            <div className="stat">
              <div className="label">Largest position</div>
              <div className="value">{fmtPct(conc.top1)}</div>
              {conc.top1 > 0.3 && <span className="pill warn">concentrated</span>}
            </div>
            <div className="stat">
              <div className="label">Top 3 combined</div>
              <div className="value">{fmtPct(conc.top3)}</div>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            {conc.rows.slice(0, 8).map((r) => (
              <div className="hbar-row" key={r.ticker}>
                <span className="hbar-label">{r.ticker}</span>
                <div className="hbar-track">
                  <div
                    className="hbar-fill"
                    style={{
                      width: `${Math.max(r.weight * 100, 1.5)}%`,
                      background: colorMap[r.ticker.toUpperCase()] ?? 'var(--accent)',
                    }}
                  />
                </div>
                <span className="hbar-value">{fmtPct(r.weight)}</span>
              </div>
            ))}
          </div>
          <p className="hint">Weights among securities — cash excluded.</p>
        </div>
      )}

      <div className="card">
        <h2>Composition</h2>

        {mix.total > 0 && (
          <>
            <h3>Asset mix</h3>
            <div className="mix-bar" role="img" aria-label="Asset mix">
              {mix.stocks > 0 && (
                <div className="mix-seg" style={{ width: `${(mix.stocks / mix.total) * 100}%`, background: 'var(--accent)' }} />
              )}
              {mix.etfs > 0 && (
                <div className="mix-seg" style={{ width: `${(mix.etfs / mix.total) * 100}%`, background: '#14b8a6' }} />
              )}
              {mix.cash > 0 && (
                <div className="mix-seg" style={{ width: `${(mix.cash / mix.total) * 100}%`, background: 'var(--neutral)' }} />
              )}
            </div>
            <div className="legend" style={{ marginTop: 8 }}>
              <span><span className="swatch" style={{ background: 'var(--accent)' }} />Stocks {fmtPct(mix.stocks / mix.total)} · {fmtMoney(mix.stocks)}</span>
              <span><span className="swatch" style={{ background: '#14b8a6' }} />ETFs {fmtPct(mix.etfs / mix.total)} · {fmtMoney(mix.etfs)}</span>
              <span><span className="swatch" style={{ background: 'var(--neutral)' }} />Cash {fmtPct(mix.cash / mix.total)} · {fmtMoney(mix.cash)}</span>
            </div>
          </>
        )}

        <h3>Sectors</h3>
        {sectors.rows.length === 0 && sectors.untagged.length === 0 && (
          <p className="muted">No open positions.</p>
        )}
        {sectors.rows.map((r, i) => (
          <div className="hbar-row" key={r.sector}>
            <span className="hbar-label" title={r.tickers.join(', ')}>{r.sector}</span>
            <div className="hbar-track">
              <div
                className="hbar-fill"
                style={{ width: `${Math.max(r.weight * 100, 1.5)}%`, background: colorForIndex(i) }}
              />
            </div>
            <span className="hbar-value">{fmtPct(r.weight)}</span>
          </div>
        ))}

        {sectors.untagged.length > 0 && (
          <>
            <p className="hint" style={{ marginTop: 10 }}>
              {sectors.untagged.length} holding{sectors.untagged.length === 1 ? '' : 's'} without a
              sector — tag below, or “Refresh prices” with a Finnhub key to classify automatically.
            </p>
            {sectors.untagged.map((t) => (
              <div className="row" key={t} style={{ alignItems: 'center', marginTop: 6 }}>
                <strong style={{ flex: '0 0 70px' }}>{t}</strong>
                <select
                  aria-label={`Sector for ${t}`}
                  defaultValue=""
                  onChange={(e) => {
                    const sector = e.target.value;
                    if (!sector) return;
                    setTickerMeta(t, {
                      sector,
                      type: sector === 'ETF / Fund' ? 'etf' : isEtf(t, tickerMeta) ? 'etf' : 'stock',
                    });
                  }}
                >
                  <option value="" disabled>Choose sector…</option>
                  {SECTOR_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            ))}
          </>
        )}
        {ledger.positions.length > 0 && sectors.untagged.length === 0 && (
          <p className="hint">Hover a sector bar to see its tickers.</p>
        )}
      </div>
    </div>
  );
}
