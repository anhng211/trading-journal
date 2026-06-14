import { useHashRoute, type Route } from './lib/route';
import { Dashboard } from './components/Dashboard';
import { DecisionList } from './components/DecisionList';
import { DecisionDetail } from './components/DecisionDetail';
import { DecisionForm } from './components/DecisionForm';
import { CompareView } from './components/CompareView';
import { PortfolioSetup } from './components/PortfolioSetup';
import { SettingsView } from './components/Settings';

const TABS: Array<{ label: string; href: string; match: Route['name'][] }> = [
  { label: 'Dashboard', href: '#/', match: ['dashboard', 'setup'] },
  { label: 'Decisions', href: '#/decisions', match: ['decisions', 'decision', 'compare'] },
  { label: '+ New Decision', href: '#/new', match: ['new'] },
  { label: 'Settings', href: '#/settings', match: ['settings'] },
];

function App() {
  const route = useHashRoute();

  return (
    <div className="wrap">
      <header className="app">
        <h1>
          Decision<span>Journal</span>
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
      {route.name === 'settings' && <SettingsView />}
    </div>
  );
}

export default App;
