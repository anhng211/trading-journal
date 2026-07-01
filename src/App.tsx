import { useHashRoute, type Route } from './lib/route';
import { Dashboard } from './components/Dashboard';
import { DecisionList } from './components/DecisionList';
import { DecisionDetail } from './components/DecisionDetail';
import { DecisionForm } from './components/DecisionForm';
import { CompareView } from './components/CompareView';
import { PortfolioSetup } from './components/PortfolioSetup';
import { XRay } from './components/XRay';
import { SettingsView } from './components/Settings';
import { useTheme } from './lib/theme';

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function ThemeToggle() {
  const { resolved, setMode } = useTheme();
  const goLight = resolved === 'dark';
  return (
    <button
      className="theme-toggle"
      onClick={() => setMode(goLight ? 'light' : 'dark')}
      title={`Switch to ${goLight ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${goLight ? 'light' : 'dark'} mode`}
    >
      {goLight ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

const TABS: Array<{ label: string; href: string; match: Route['name'][] }> = [
  { label: 'Dashboard', href: '#/', match: ['dashboard', 'setup'] },
  { label: 'Decisions', href: '#/decisions', match: ['decisions', 'decision', 'compare'] },
  { label: 'X-Ray', href: '#/xray', match: ['xray'] },
  { label: '+ New Decision', href: '#/new', match: ['new'] },
  { label: 'Settings', href: '#/settings', match: ['settings'] },
];

function App() {
  const route = useHashRoute();

  return (
    <div className="wrap">
      <ThemeToggle />
      <header className="app">
        <h1>
          Trading &amp; Investment <span>Journal</span>
        </h1>
        <p>Log the thesis. Diff the portfolio. Compare against doing nothing.</p>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <a key={t.href} href={t.href} className={t.match.includes(route.name) ? 'active' : ''}>
            {t.label}
          </a>
        ))}
      </nav>

      {route.name === 'dashboard' && <Dashboard />}
      {route.name === 'decisions' && <DecisionList />}
      {route.name === 'decision' && <DecisionDetail id={route.id} />}
      {route.name === 'compare' && <CompareView a={route.a} b={route.b} />}
      {route.name === 'new' && <DecisionForm />}
      {route.name === 'setup' && <PortfolioSetup />}
      {route.name === 'xray' && <XRay />}
      {route.name === 'settings' && <SettingsView />}
    </div>
  );
}

export default App;
