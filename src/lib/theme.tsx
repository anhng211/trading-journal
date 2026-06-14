import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const KEY = 'trading-journal-theme';

export function readMode(): ThemeMode {
  const v = localStorage.getItem(KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

function resolve(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

function apply(mode: ThemeMode) {
  const r = resolve(mode);
  document.documentElement.dataset.theme = r;
  document.documentElement.style.colorScheme = r;
}

interface ThemeCtx {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readMode);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(readMode()));

  useEffect(() => {
    apply(mode);
    setResolved(resolve(mode));
    // Follow the OS only while in 'system' mode.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (mode === 'system') {
        apply('system');
        setResolved(resolve('system'));
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  const setMode = (m: ThemeMode) => {
    localStorage.setItem(KEY, m);
    setModeState(m);
  };

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
