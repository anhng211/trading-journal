import { useState } from 'react';
import { useJournal } from '../store/journal';
import { fmtDate, fmtMoney, fmtMoneyExact } from '../lib/format';

/** Deposits & withdrawals, Trading 212 "funds" style. */
export function FundsCard() {
  const cashEvents = useJournal((s) => s.cashEvents);
  const settings = useJournal((s) => s.settings);
  const addCashEvent = useJournal((s) => s.addCashEvent);
  const deleteCashEvent = useJournal((s) => s.deleteCashEvent);

  const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  const sorted = [...cashEvents].sort((a, b) => b.datetime.localeCompare(a.datetime));
  const deposited =
    settings.startingCash +
    cashEvents.reduce((s, e) => s + (e.type === 'deposit' ? e.amount : 0), 0);
  const withdrawn = cashEvents.reduce(
    (s, e) => s + (e.type === 'withdrawal' ? e.amount : 0),
    0,
  );

  const submit = () => {
    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) return;
    addCashEvent({
      datetime: new Date(`${date}T12:00:00`).toISOString(),
      type,
      amount: v,
      note: note.trim() || undefined,
    });
    setAmount('');
    setNote('');
  };

  return (
    <div className="card">
      <h2>Funds</h2>
      <p className="muted">
        Deposited {fmtMoney(deposited)} (incl. {fmtMoney(settings.startingCash)} initial)
        {withdrawn > 0 && <> · withdrawn {fmtMoney(withdrawn)}</>} · total return is measured
        against net deposits, so adding money never counts as gains.
      </p>

      <div className="row" style={{ marginTop: 12 }}>
        <div>
          <label htmlFor="f-type">Type</label>
          <select id="f-type" value={type} onChange={(e) => setType(e.target.value as 'deposit' | 'withdrawal')}>
            <option value="deposit">Deposit</option>
            <option value="withdrawal">Withdrawal</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-amount">Amount $</label>
          <input id="f-amount" type="number" min={0} step="any" value={amount}
            onChange={(e) => setAmount(e.target.value)} placeholder="500" />
        </div>
        <div>
          <label htmlFor="f-date">Date</label>
          <input id="f-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="f-note">Note</label>
          <input id="f-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="monthly savings" />
        </div>
        <button className="primary" onClick={submit}>Add</button>
      </div>

      {sorted.length > 0 && (
        <table style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Date</th><th>Type</th><th className="num">Amount</th><th>Note</th><th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => (
              <tr key={e.id}>
                <td>{fmtDate(e.datetime)}</td>
                <td>
                  <span className={`pill ${e.type === 'deposit' ? 'gain' : 'warn'}`}>
                    {e.type === 'deposit' ? '+ DEPOSIT' : '− WITHDRAWAL'}
                  </span>
                </td>
                <td className="num">{fmtMoneyExact(e.amount)}</td>
                <td className="muted">{e.note ?? ''}</td>
                <td className="num">
                  <button
                    className="small danger"
                    aria-label={`Delete ${e.type} of ${fmtMoneyExact(e.amount)}`}
                    onClick={() => {
                      if (confirm(`Delete this ${e.type} of ${fmtMoneyExact(e.amount)}?`)) {
                        deleteCashEvent(e.id);
                      }
                    }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
