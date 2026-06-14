import { useEffect, useState } from 'react';

export type Route =
  | { name: 'dashboard' }
  | { name: 'decisions' }
  | { name: 'decision'; id: string }
  | { name: 'compare'; a: string; b: string }
  | { name: 'new' }
  | { name: 'setup' }
  | { name: 'settings' };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'decisions' && parts[1]) return { name: 'decision', id: parts[1] };
  if (parts[0] === 'decisions') return { name: 'decisions' };
  if (parts[0] === 'compare' && parts[1] && parts[2]) return { name: 'compare', a: parts[1], b: parts[2] };
  if (parts[0] === 'new') return { name: 'new' };
  if (parts[0] === 'setup') return { name: 'setup' };
  if (parts[0] === 'settings') return { name: 'settings' };
  return { name: 'dashboard' };
}

export function navigate(path: string) {
  window.location.hash = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`;
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
