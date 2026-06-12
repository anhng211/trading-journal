import { useState } from 'react';
import { useJournal } from '../store/journal';
import type { Decision, Grade } from '../types';
import { decisionOutcome } from '../lib/portfolio';
import { fmtDate, fmtSignedMoney, fmtSignedPct } from '../lib/format';

const GRADES: Grade[] = ['A', 'B', 'C', 'D', 'F'];

export function ReviewModal({ decision, onClose }: { decision: Decision; onClose: () => void }) {
  const trades = useJournal((s) => s.trades);
  const settings = useJournal((s) => s.settings);
  const prices = useJournal((s) => s.prices);
  const saveReview = useJournal((s) => s.saveReview);

  const [grade, setGrade] = useState<Grade>(decision.review?.grade ?? 'B');
  const [notes, setNotes] = useState(decision.review?.notes ?? '');

  const hasPrices = Object.keys(prices).length > 0;
  const outcome = hasPrices ? decisionOutcome(decision, trades, settings, prices) : null;

  const save = () => {
    saveReview(decision.id, { date: new Date().toISOString(), grade, notes: notes.trim() });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Review: {decision.title}</h2>
        <p className="muted">Decided {fmtDate(decision.datetime)} · confidence {decision.confidence}/5</p>

        <h3>You expected</h3>
        <p style={{ fontWeight: 600 }}>
          {decision.expected.text || <span className="muted">No expectation was recorded.</span>}
        </p>

        <h3>What actually happened</h3>
        {outcome ? (
          <p style={{ fontWeight: 700 }}>
            Versus doing nothing:{' '}
            <span className={outcome.delta >= 0 ? 'delta-gain' : 'delta-loss'}>
              {fmtSignedMoney(outcome.delta)} ({fmtSignedPct(outcome.pct)})
            </span>
          </p>
        ) : (
          <p className="muted">No price data yet — refresh or enter prices to quantify the outcome.</p>
        )}

        <label>Grade the decision (the reasoning, not just the result)</label>
        <div className="row" style={{ marginBottom: 6 }}>
          {GRADES.map((g) => (
            <button
              key={g}
              className={grade === g ? 'primary' : ''}
              onClick={() => setGrade(g)}
              style={{ minWidth: 0 }}
            >
              {g}
            </button>
          ))}
        </div>

        <label htmlFor="rev-notes">Review notes</label>
        <textarea
          id="rev-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Was the thesis right? Was the sizing right? What would you repeat or avoid?"
        />

        <div className="row" style={{ marginTop: 16 }}>
          <button className="primary" onClick={save}>Save review</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
