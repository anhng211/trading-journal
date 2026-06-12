import { useRef, useState } from 'react';
import { useJournal } from '../store/journal';
import { makeDemoData } from '../lib/demo';

export function SettingsView() {
  const settings = useJournal((s) => s.settings);
  const setSettings = useJournal((s) => s.setSettings);
  const exportJSON = useJournal((s) => s.exportJSON);
  const importJSON = useJournal((s) => s.importJSON);
  const loadData = useJournal((s) => s.loadData);
  const resetAll = useJournal((s) => s.resetAll);

  const [key, setKey] = useState(settings.finnhubKey ?? '');
  const [cash, setCash] = useState(String(settings.startingCash));
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const save = () => {
    const startingCash = Number(cash);
    setSettings({
      finnhubKey: key.trim() || undefined,
      startingCash: Number.isFinite(startingCash) && startingCash >= 0 ? startingCash : settings.startingCash,
    });
    setMessage('Settings saved.');
  };

  const doExport = () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading-journal-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importJSON(String(reader.result));
      setMessage(ok ? 'Journal imported.' : 'Import failed — not a valid journal export.');
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <div className="card">
        <h2>Settings</h2>
        {message && <p className="hint">{message}</p>}

        <label htmlFor="s-key">Finnhub API key (free at finnhub.io — stays in this browser)</label>
        <input
          id="s-key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="paste your API key"
        />

        <label htmlFor="s-cash">Initial deposit ($) — cash at inception; add later top-ups in Funds on the Dashboard</label>
        <input id="s-cash" type="number" min={0} step="any" value={cash} onChange={(e) => setCash(e.target.value)} />

        <div style={{ marginTop: 14 }}>
          <button className="primary" onClick={save}>Save settings</button>
        </div>
        <p className="hint">
          Without an API key everything still works — click any price on the Dashboard to enter it
          manually.
        </p>
      </div>

      <div className="card">
        <h2>Data</h2>
        <p className="muted">
          Your journal lives in this browser (localStorage). Export regularly, and use
          import to move it to another device.
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          <button onClick={doExport}>⬇ Export JSON</button>
          <button onClick={() => fileRef.current?.click()}>⬆ Import JSON</button>
          <button onClick={() => { loadData(makeDemoData()); setMessage('Demo data loaded.'); }}>
            Load demo data
          </button>
          <button
            className="danger"
            onClick={() => {
              if (confirm('Delete ALL journal data from this browser? Export first if unsure.')) {
                resetAll();
                setMessage('Journal cleared.');
              }
            }}
          >
            Reset everything
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) doImport(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
