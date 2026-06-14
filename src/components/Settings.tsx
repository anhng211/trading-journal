import { useRef, useState } from 'react';
import { useJournal } from '../store/journal';
import { makeDemoData } from '../lib/demo';
import { useTheme, type ThemeMode } from '../lib/theme';

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function SettingsView() {
  const { mode, setMode } = useTheme();
  const settings = useJournal((s) => s.settings);
  const setSettings = useJournal((s) => s.setSettings);
  const exportJSON = useJournal((s) => s.exportJSON);
  const importJSON = useJournal((s) => s.importJSON);
  const loadData = useJournal((s) => s.loadData);
  const resetAll = useJournal((s) => s.resetAll);

  const [key, setKey] = useState(settings.finnhubKey ?? '');
  const [cash, setCash] = useState(String(settings.startingCash));
  const [benchmark, setBenchmark] = useState(settings.benchmarkTicker ?? 'SPY');
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const save = () => {
    const startingCash = Number(cash);
    setSettings({
      finnhubKey: key.trim() || undefined,
      startingCash: Number.isFinite(startingCash) && startingCash >= 0 ? startingCash : settings.startingCash,
      benchmarkTicker: benchmark.trim().toUpperCase() || undefined,
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

        <label>Appearance</label>
        <div className="seg" role="group" aria-label="Theme">
          {THEME_OPTIONS.map((o) => (
            <button
              key={o.value}
              className={mode === o.value ? 'active' : ''}
              aria-pressed={mode === o.value}
              onClick={() => setMode(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="hint">“Auto” follows your device’s light/dark setting.</p>

        <label htmlFor="s-key">Finnhub API key (free at finnhub.io — stays in this browser)</label>
        <input
          id="s-key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="paste your API key"
        />

        <label htmlFor="s-cash">Initial deposit ($) — cash at inception; add later top-ups in Funds on the Dashboard</label>
        <input id="s-cash" type="number" min={0} step="any" value={cash} onChange={(e) => setCash(e.target.value)} />

        <label htmlFor="s-bench">Benchmark ticker (the equity curve compares against this)</label>
        <input id="s-bench" value={benchmark} onChange={(e) => setBenchmark(e.target.value.toUpperCase())} placeholder="SPY" />

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
          <a className="btn" href="#/setup">＋ Set up / add holdings</a>
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
