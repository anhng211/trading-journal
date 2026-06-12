import { useMemo } from 'react';
import { useJournal } from '../store/journal';
import { diffPortfolios, replayLedger } from '../lib/portfolio';
import { DiffTable } from './DiffTable';
import { Slopegraph } from './Slopegraph';
import { fmtDate, fmtMoney } from '../lib/format';

/** Arbitrary A-vs-B comparison: portfolio as of decision A vs as of decision B. */
export function CompareView({ a, b }: { a: string; b: string }) {
  const decisions = useJournal((s) => s.decisions);
  const trades = useJournal((s) => s.trades);
  const cashEvents = useJournal((s) => s.cashEvents);
  const settings = useJournal((s) => s.settings);
  const prices = useJournal((s) => s.prices);

  const da = decisions.find((d) => d.id === a);
  const db = decisions.find((d) => d.id === b);

  const result = useMemo(() => {
    if (!da || !db) return null;
    const [earlier, later] = da.datetime <= db.datetime ? [da, db] : [db, da];
    const stateA = replayLedger(trades, cashEvents, settings.startingCash, earlier.datetime, true);
    const stateB = replayLedger(trades, cashEvents, settings.startingCash, later.datetime, true);
    return { earlier, later, stateA, stateB, diff: diffPortfolios(stateA, stateB, prices) };
  }, [da, db, trades, cashEvents, settings, prices]);

  if (!result) {
    return (
      <div className="card">
        <p className="muted">One of the selected decisions no longer exists.</p>
        <a className="btn" href="#/decisions">← Back to decisions</a>
      </div>
    );
  }

  const { earlier, later, stateA, stateB, diff } = result;

  return (
    <div>
      <div className="card">
        <h2>Compare: “{earlier.title}” → “{later.title}”</h2>
        <p className="muted">
          Portfolio as of {fmtDate(earlier.datetime)} vs. as of {fmtDate(later.datetime)} — every
          change made by the decisions in between, in one diff.
        </p>
        <div className="stat-grid" style={{ marginTop: 14 }}>
          <div className="stat">
            <div className="label">As of {fmtDate(earlier.datetime)}</div>
            <div className="value">{stateA.positions.length} positions</div>
            <div className="muted">cash {fmtMoney(stateA.cash)}</div>
          </div>
          <div className="stat">
            <div className="label">As of {fmtDate(later.datetime)}</div>
            <div className="value">{stateB.positions.length} positions</div>
            <div className="muted">cash {fmtMoney(stateB.cash)}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Diff</h2>
        <div style={{ margin: '14px 0' }}>
          <DiffTable rows={diff} />
        </div>
        <Slopegraph rows={diff} labels={[fmtDate(earlier.datetime), fmtDate(later.datetime)]} />
      </div>

      <div className="row" style={{ marginBottom: 24 }}>
        <a className="btn" href="#/decisions">← All decisions</a>
        <a className="btn" href={`#/decisions/${earlier.id}`}>Open “{earlier.title}”</a>
        <a className="btn" href={`#/decisions/${later.id}`}>Open “{later.title}”</a>
      </div>
    </div>
  );
}
