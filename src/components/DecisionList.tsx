import { useState } from 'react';
import { useJournal } from '../store/journal';
import { decisionOutcome } from '../lib/portfolio';
import { fmtDate, fmtSignedPct } from '../lib/format';

export function DecisionList() {
  const decisions = useJournal((s) => s.decisions);
  const trades = useJournal((s) => s.trades);
  const settings = useJournal((s) => s.settings);
  const prices = useJournal((s) => s.prices);
  const [selected, setSelected] = useState<string[]>([]);

  const sorted = [...decisions].sort((a, b) => b.datetime.localeCompare(a.datetime));
  const hasPrices = Object.keys(prices).length > 0;

  const toggle = (id: string) =>
    setSelected((sel) =>
      sel.includes(id) ? sel.filter((s) => s !== id) : [...sel.slice(-1), id],
    );

  if (sorted.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <div className="big">📓</div>
          <p>No decisions yet. Every entry starts with a thesis.</p>
          <p style={{ marginTop: 12 }}>
            <a className="btn primary" href="#/new">+ Log your first decision</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <h2>Decisions</h2>
        <p className="muted">
          Click a decision to see its diff and counterfactual. Use <strong>Select</strong> on two
          decisions to compare any pair.
        </p>
      </div>

      {sorted.map((d) => {
        const outcome = hasPrices ? decisionOutcome(d, trades, settings, prices) : null;
        const isSel = selected.includes(d.id);
        const tradeCount = trades.filter((t) => t.decisionId === d.id).length;
        return (
          <a key={d.id} className={`decision-item${isSel ? ' selected' : ''}`} href={`#/decisions/${d.id}`}>
            <div className="title-line">
              <strong>{d.title}</strong>
              <span className="muted">{fmtDate(d.datetime)}</span>
            </div>
            <div className="tag-row">
              <span className="pill accent">conf {d.confidence}/5</span>
              <span className="pill neutral">{tradeCount} trade{tradeCount === 1 ? '' : 's'}</span>
              {d.tags.map((t) => (
                <span key={t} className="pill neutral">{t}</span>
              ))}
              {outcome && (
                <span className={`pill ${outcome.delta >= 0 ? 'gain' : 'loss'}`}>
                  vs doing nothing: {fmtSignedPct(outcome.pct)}
                </span>
              )}
              {d.review && <span className="pill warn">graded {d.review.grade}</span>}
              <button
                className="small"
                style={{ marginLeft: 'auto' }}
                onClick={(e) => {
                  e.preventDefault();
                  toggle(d.id);
                }}
              >
                {isSel ? '✓ Selected' : 'Select'}
              </button>
            </div>
          </a>
        );
      })}

      {selected.length === 2 && (
        <div className="compare-bar">
          <span>2 decisions selected</span>
          <a className="btn" href={`#/compare/${selected[0]}/${selected[1]}`}>
            Compare A ↔ B
          </a>
        </div>
      )}
    </div>
  );
}
