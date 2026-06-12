export const fmtMoney = (v: number): string =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export const fmtMoneyExact = (v: number): string =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export const fmtPct = (v: number, digits = 1): string => `${(v * 100).toFixed(digits)}%`;

export const fmtSignedPct = (v: number, digits = 1): string =>
  `${v >= 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`;

export const fmtSignedMoney = (v: number): string => `${v >= 0 ? '+' : '−'}${fmtMoney(Math.abs(v))}`;

export const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

export const fmtShares = (v: number): string =>
  Number.isInteger(v) ? String(v) : v.toFixed(2);
