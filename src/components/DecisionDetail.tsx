import { useMemo, useState } from 'react';
import { useJournal } from '../store/journal';
import {
  decisionOutcome,
  decisionPortfolios,
  diffPortfolios,
  ghostSeries,
} from '../lib/portfolio';
import { DiffTable } from './DiffTable';
import { Slopegraph } from './Slopegraph';
import { GhostChart } from './GhostChart';
import { ReviewModal } from './ReviewModal';
import {
  fmtDate,
  fmtMoney,
  fmtMoneyExact,
  fmtShares,
  fmtSignedMoney,
  fmtSignedPct,
} from '../lib/format';
import { navigate } from '../lib/route';

export function DecisionDetail({ id }: { id: string }) {
  const decisions = useJournal((s) => s.decisions);
  const trades = useJournal((s) => s.trades);
  const settings = useJournal((s) => s.settings);
  const prices = useJournal((s) => s.prices);
  const priceSnapshots = useJournal((s) => s.priceSnapshots);
  const deleteDecision = useJournal((s) => s.deleteDecision);
  const [reviewing, setReviewing] = useState(false);

  const decision = decisions.find((d) => d.id === id);

  const derived = useMemo(() => {
    if (!decision) return null;
    const { ghost, acted } = decisionPortfolios(decision, trades, settings);
    return {
      ghost,
      acted,
      diff: diffPortfolios(ghost, acted, prices),
      series: ghostSeries(decision, trades, settings, prices, priceSnapshots),
      outcome: Object.keys(prices).length > 0 ? decisionOutcome(decision, trades, settings, prices) : null,
    };
  }, [decision, trades, settings, prices, priceSnapshots]);

  if (!decision || !derived) {
    return (
      <div className="card">
        <p className="muted">Decision not found.</p>
        <a className="btn" href="#/decisions">← Back to decisions</a>
      </div>
    );
  }

  const myTrades = trades.filter((t) => t.decisionId === decision.id);
  const reviewDue =
    !decision.review &&
    decision.expected.reviewBy &&
    new Date(decision.expected.reviewBy) <= new Date();

  return (
    <div>
      <div className="card">
        <div className="title-line" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h2>{decision.title}</h2>
          <span className="muted">{fmtDate(decision.datetime)}</span>
        </div>
        <div className="tag-row" style={{ marginBottom: 10 }}>
          <span className="pill accent">confidence {decision.confidence}/5</span>
          {decision.tags.map((t) => (
            <span key={t} className="pill neutral">{t}</span>
          ))}
          {decision.review && <span className="pill warn">graded {decision.review.grade}</span>}
          {reviewDue && <span className="pill loss">review due</span>}
        </div>
        <h3>Thesis</h3>
        <p style={{ fontWeight: 600, whiteSpace: 'pre-wrap' }}>{decision.thesis}</p>
        {decision.expected.text && (
          <>
            <h3>Expected</h3>
            <p style={{ fontWeight: 600, whiteSpace: 'pre-wrap' }}>
              {decision.expected.text}
              {decision.expected.reviewBy && (
                <span className="muted"> — review by {fmtDate(decision.expected.reviewBy)}</span>
              )}
            </p>
          </>
        )}
      </div>

      <div className="card">
        <h2>What changed — before vs. after</h2>
        <p className="muted">
          Portfolio just before this decision vs. just after its trades executed. Later decisions
          are not included, so this isolates the change you made here.
        </p>
        <div style={{ margin: '14px 0' }}>
          <DiffTable rows={derived.diff} />
        </div>
        <Slopegraph rows={derived.diff} labels={['Before', 'After']} />
        <p className="muted">
          Cash: {fmtMoney(derived.ghost.cash)} → {fmtMoney(derived.acted.cash)}
        </p>
      </div>

      <div className="card">
        <h2>Was it better than doing nothing?</h2>
        {derived.outcome && (
          <div className="stat-grid">
            <div className="stat">
              <div className="label">What you did</div>
              <div className="value">{fmtMoney(derived.outcome.actedValue)}</div>
            </div>
            <div className="stat">
              <div className="label">If you'd done nothing</div>
              <div className="value">{fmtMoney(derived.outcome.ghostValue)}</div>
            </div>
            <div className="stat">
              <div className="label">Decision value</div>
              <div className={`value ${derived.outcome.delta >= 0 ? 'delta-gain' : 'delta-loss'}`}>
                {fmtSignedMoney(derived.outcome.delta)} ({fmtSignedPct(derived.outcome.pct)})
              </div>
            </div>
          </div>
        )}
        <GhostChart points={derived.series} />
      </div>

      <div className="card">
        <h2>Trades in this decision</h2>
        <table>
          <thead>
            <tr>
              <th>Ticker</th><th>Side</th><th className="num">Shares</th>
              <th className="num">Price</th><th className="num">Fees</th><th>Note</th>
            </tr>
          </thead>
          <tbody>
            {myTrades.map((t) => (
              <tr key={t.id}>
                <td><strong>{t.ticker}</strong></td>
                <td>
                  <span className={`pill ${t.side === 'buy' ? 'gain' : 'loss'}`}>
                    {t.side.toUpperCase()}
                  </span>
                </td>
                <td className="num">{fmtShares(t.shares)}</td>
                <td className="num">{fmtMoneyExact(t.price)}</td>
                <td className="num">{fmtMoneyExact(t.fees)}</td>
                <td className="muted">{t.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {decision.review && (
        <div className="card">
          <h2>Review — graded {decision.review.grade}</h2>
          <p className="muted">Reviewed {fmtDate(decision.review.date)}</p>
          <p style={{ fontWeight: 600, whiteSpace: 'pre-wrap', marginTop: 8 }}>{decision.review.notes}</p>
        </div>
      )}

      <div className="row" style={{ marginBottom: 24 }}>
        <a className="btn" href="#/decisions">← All decisions</a>
        <button className="primary" onClick={() => setReviewing(true)}>
          {decision.review ? 'Update review' : 'Review this decision'}
        </button>
        <button
          className="danger"
          onClick={() => {
            if (confirm(`Delete "${decision.title}" and its ${myTrades.length} trade(s)?`)) {
              deleteDecision(decision.id);
              navigate('/decisions');
            }
          }}
        >
          Delete
        </button>
      </div>

      {reviewing && <ReviewModal decision={decision} onClose={() => setReviewing(false)} />}
    </div>
  );
}
