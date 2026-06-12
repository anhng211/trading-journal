import { useState } from 'react';
import { useJournal, type TradeInput } from '../store/journal';
import type { Confidence } from '../types';
import { navigate } from '../lib/route';

interface TradeRow extends TradeInput {
  key: string;
}

const blankTrade = (): TradeRow => ({
  key: crypto.randomUUID(),
  ticker: '',
  side: 'buy',
  shares: 0,
  price: 0,
  fees: 0,
});

export function DecisionForm() {
  const addDecision = useJournal((s) => s.addDecision);

  const [title, setTitle] = useState('');
  const [datetime, setDatetime] = useState(() => new Date().toISOString().slice(0, 10));
  const [thesis, setThesis] = useState('');
  const [confidence, setConfidence] = useState<Confidence>(3);
  const [tags, setTags] = useState('');
  const [expectedText, setExpectedText] = useState('');
  const [reviewBy, setReviewBy] = useState('');
  const [trades, setTrades] = useState<TradeRow[]>([blankTrade()]);
  const [error, setError] = useState('');

  const updateTrade = (key: string, patch: Partial<TradeRow>) =>
    setTrades((ts) => ts.map((t) => (t.key === key ? { ...t, ...patch } : t)));

  const submit = () => {
    const valid = trades.filter((t) => t.ticker.trim() && t.shares > 0 && t.price > 0);
    if (!title.trim()) return setError('Give the decision a title.');
    if (!thesis.trim()) return setError('Write the thesis — future-you will want to know why.');
    if (valid.length === 0) return setError('Add at least one trade with ticker, shares, and price.');

    const id = addDecision({
      datetime: new Date(`${datetime}T12:00:00`).toISOString(),
      title: title.trim(),
      thesis: thesis.trim(),
      confidence,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      expected: {
        text: expectedText.trim(),
        reviewBy: reviewBy ? new Date(`${reviewBy}T12:00:00`).toISOString() : undefined,
      },
      trades: valid.map(({ key: _key, ...t }) => ({ ...t, ticker: t.ticker.toUpperCase() })),
    });
    navigate(`/decisions/${id}`);
  };

  return (
    <div className="card">
      <h2>New Decision</h2>
      <p className="muted">
        A decision is the thesis plus the trades that execute it. The portfolio before this
        decision is frozen as the “ghost” so you can later see what doing nothing would have done.
      </p>

      {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}

      <div className="grid2">
        <div>
          <label htmlFor="d-title">Title</label>
          <input id="d-title" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Rotate INTC into NVDA" />
        </div>
        <div>
          <label htmlFor="d-date">Decision date</label>
          <input id="d-date" type="date" value={datetime} onChange={(e) => setDatetime(e.target.value)} />
        </div>
      </div>

      <label htmlFor="d-thesis">Thesis — why are you doing this?</label>
      <textarea id="d-thesis" value={thesis} onChange={(e) => setThesis(e.target.value)}
        placeholder="The reasoning you'll be graded against later…" />

      <div className="grid2">
        <div>
          <label htmlFor="d-conf">Confidence: {confidence}/5</label>
          <input id="d-conf" type="range" min={1} max={5} step={1} value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value) as Confidence)} />
        </div>
        <div>
          <label htmlFor="d-tags">Tags (comma-separated)</label>
          <input id="d-tags" value={tags} onChange={(e) => setTags(e.target.value)}
            placeholder="rotation, semis, long-term" />
        </div>
      </div>

      <h3>Trades</h3>
      {trades.map((t) => (
        <div className="trade-row-grid" key={t.key}>
          <div>
            <label>Ticker</label>
            <input value={t.ticker} onChange={(e) => updateTrade(t.key, { ticker: e.target.value.toUpperCase() })}
              placeholder="AAPL" />
          </div>
          <div>
            <label>Side</label>
            <select value={t.side} onChange={(e) => updateTrade(t.key, { side: e.target.value as 'buy' | 'sell' })}>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>
          <div>
            <label>Shares</label>
            <input type="number" min={0} step="any" value={t.shares || ''}
              onChange={(e) => updateTrade(t.key, { shares: Number(e.target.value) })} />
          </div>
          <div>
            <label>Price $</label>
            <input type="number" min={0} step="any" value={t.price || ''}
              onChange={(e) => updateTrade(t.key, { price: Number(e.target.value) })} />
          </div>
          <div>
            <label>Fees $</label>
            <input type="number" min={0} step="any" value={t.fees || ''}
              onChange={(e) => updateTrade(t.key, { fees: Number(e.target.value) })} />
          </div>
          <button
            className="small danger"
            onClick={() => setTrades((ts) => ts.filter((x) => x.key !== t.key))}
            disabled={trades.length === 1}
            aria-label={`Remove trade ${t.ticker || ''}`}
          >
            ✕
          </button>
        </div>
      ))}
      <button className="small" onClick={() => setTrades((ts) => [...ts, blankTrade()])}>
        + Add trade
      </button>

      <h3>Expectations (graded at review)</h3>
      <label htmlFor="d-expected">What do you expect to happen?</label>
      <textarea id="d-expected" value={expectedText} onChange={(e) => setExpectedText(e.target.value)}
        placeholder="e.g. NVDA outperforms INTC by 15%+ over 6 months on datacenter demand" />
      <div className="grid2">
        <div>
          <label htmlFor="d-reviewby">Review by</label>
          <input id="d-reviewby" type="date" value={reviewBy} onChange={(e) => setReviewBy(e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <button className="primary" onClick={submit}>Save decision</button>
      </div>
    </div>
  );
}
