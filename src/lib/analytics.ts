import type { CashEvent, Position, PriceCache, PriceSnapshot, TickerMeta, Trade } from '../types';
import { portfolioValue, priceOf, replayLedger } from './portfolio';

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

/** Minimum snapshot-to-snapshot observations before risk stats are shown. */
export const MIN_OBS = 5;
/** Below this many observations, stats carry a low-confidence caveat. */
export const LOW_CONFIDENCE_OBS = 12;

export interface IntervalReturn {
  t0: string;
  t1: string;
  /** Portfolio return over the interval, adjusted for external cash flows. */
  rp: number;
  /** Benchmark return over the same interval, when both prices are known. */
  rb: number | null;
}

/**
 * Snapshot-to-snapshot returns. Portfolio returns are time-weighted:
 * deposits/withdrawals inside an interval are subtracted from the end value
 * so adding money never looks like performance. Trades are internal
 * (cash ↔ stock) and cancel out of total value by construction.
 */
export function intervalReturns(
  trades: Trade[],
  cashEvents: CashEvent[],
  startingCash: number,
  snapshots: PriceSnapshot[],
  benchmarkTicker?: string,
): IntervalReturn[] {
  const bench = benchmarkTicker?.toUpperCase();
  const out: IntervalReturn[] = [];

  let prev: { t: string; value: number; benchPrice: number | null } | null = null;
  for (const snap of snapshots) {
    const state = replayLedger(trades, cashEvents, startingCash, snap.t, true);
    const value = portfolioValue(state.positions, state.cash, snap.prices);
    const benchPrice = bench != null && snap.prices[bench] > 0 ? snap.prices[bench] : null;

    if (prev && prev.value > 0) {
      const flow = cashEvents.reduce((sum, e) => {
        if (e.datetime > prev!.t && e.datetime <= snap.t) {
          return sum + (e.type === 'deposit' ? e.amount : -e.amount);
        }
        return sum;
      }, 0);
      out.push({
        t0: prev.t,
        t1: snap.t,
        rp: (value - flow) / prev.value - 1,
        rb: prev.benchPrice != null && benchPrice != null ? benchPrice / prev.benchPrice - 1 : null,
      });
    }
    prev = { t: snap.t, value, benchPrice };
  }
  return out;
}

export interface RiskStats {
  /** Portfolio return observations used. */
  n: number;
  /** Observations where the benchmark was also known (beta/alpha/R²). */
  pairedN: number;
  spanDays: number;
  annReturn: number;
  annVol: number | null;
  sharpe: number | null;
  maxDrawdown: number;
  beta: number | null;
  alpha: number | null;
  r2: number | null;
  benchAnnReturn: number | null;
  lowConfidence: boolean;
}

/**
 * Annualized risk statistics from irregular interval returns.
 * Annualization uses the observed frequency (n intervals over the span),
 * which is honest for user-driven refresh cadences.
 */
export function riskStats(intervals: IntervalReturn[], riskFreeRatePct = 4): RiskStats | null {
  const rs = intervals.filter((i) => Number.isFinite(i.rp));
  if (rs.length < MIN_OBS) return null;

  const spanMs = new Date(rs[rs.length - 1].t1).getTime() - new Date(rs[0].t0).getTime();
  if (spanMs <= 0) return null;
  const spanYears = spanMs / MS_PER_YEAR;
  const periodsPerYear = rs.length / spanYears;

  const rp = rs.map((i) => i.rp);
  const mean = avg(rp);
  const sd = stddev(rp);

  // Chained time-weighted index → CAGR and max drawdown.
  let index = 1;
  let peak = 1;
  let maxDrawdown = 0;
  for (const r of rp) {
    index *= 1 + r;
    if (index > peak) peak = index;
    const dd = index / peak - 1;
    if (dd < maxDrawdown) maxDrawdown = dd;
  }
  const annReturn = Math.pow(Math.max(index, 1e-9), 1 / spanYears) - 1;

  const rf = riskFreeRatePct / 100;
  const rfPerPeriod = rf / periodsPerYear;
  const annVol = sd != null ? sd * Math.sqrt(periodsPerYear) : null;
  const sharpe =
    sd != null && sd > 1e-12 ? ((mean - rfPerPeriod) / sd) * Math.sqrt(periodsPerYear) : null;

  // Benchmark-relative stats over paired observations only.
  const pairs = rs.filter((i) => i.rb != null && Number.isFinite(i.rb));
  let beta: number | null = null;
  let alpha: number | null = null;
  let r2: number | null = null;
  let benchAnnReturn: number | null = null;
  if (pairs.length >= MIN_OBS) {
    const pp = pairs.map((i) => i.rp);
    const bb = pairs.map((i) => i.rb as number);
    const varB = variance(bb);
    if (varB != null && varB > 1e-12) {
      beta = covariance(pp, bb)! / varB;
      const varP = variance(pp);
      if (varP != null && varP > 1e-12) {
        const corr = covariance(pp, bb)! / Math.sqrt(varP * varB);
        r2 = corr * corr;
      }
      const pairSpanMs =
        new Date(pairs[pairs.length - 1].t1).getTime() - new Date(pairs[0].t0).getTime();
      const pairSpanYears = Math.max(pairSpanMs / MS_PER_YEAR, 1e-9);
      const benchIndex = bb.reduce((acc, r) => acc * (1 + r), 1);
      benchAnnReturn = Math.pow(Math.max(benchIndex, 1e-9), 1 / pairSpanYears) - 1;
      // Jensen's alpha on annualized figures.
      alpha = annReturn - (rf + beta * (benchAnnReturn - rf));
    }
  }

  return {
    n: rs.length,
    pairedN: pairs.length,
    spanDays: Math.round(spanMs / (24 * 3600 * 1000)),
    annReturn,
    annVol,
    sharpe,
    maxDrawdown,
    beta,
    alpha,
    r2,
    benchAnnReturn,
    lowConfidence: rs.length < LOW_CONFIDENCE_OBS,
  };
}

// ---------- Composition / concentration (no history needed) ----------

export interface ConcentrationRow {
  ticker: string;
  value: number;
  /** Weight among securities (cash excluded), 0..1. */
  weight: number;
}

export interface Concentration {
  rows: ConcentrationRow[]; // sorted desc
  count: number;
  top1: number;
  top3: number;
  /** 1/Σw² — "effective number of holdings"; equals count when equal-weighted. */
  effectiveN: number;
}

export function concentration(positions: Position[], prices: PriceCache): Concentration | null {
  const rows = positions
    .map((p) => ({ ticker: p.ticker, value: p.shares * priceOf(p.ticker, prices, p.avgCost) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (total <= 0) return null;

  const withW = rows.map((r) => ({ ...r, weight: r.value / total }));
  const herfindahl = withW.reduce((s, r) => s + r.weight * r.weight, 0);
  return {
    rows: withW,
    count: withW.length,
    top1: withW[0]?.weight ?? 0,
    top3: withW.slice(0, 3).reduce((s, r) => s + r.weight, 0),
    effectiveN: herfindahl > 0 ? 1 / herfindahl : 0,
  };
}

export const SECTOR_OPTIONS = [
  'Technology',
  'Semiconductors',
  'Software',
  'Communication Services',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Financial Services',
  'Healthcare',
  'Industrials',
  'Energy',
  'Utilities',
  'Real Estate',
  'Basic Materials',
  'ETF / Fund',
  'Other',
];

export const KNOWN_ETFS = new Set([
  'SPY', 'VOO', 'IVV', 'VTI', 'QQQ', 'QQQM', 'DIA', 'IWM', 'VEA', 'VWO', 'VXUS',
  'BND', 'AGG', 'TLT', 'GLD', 'SLV', 'SCHD', 'VYM', 'VIG', 'VUG', 'VTV', 'VGT',
  'XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLP', 'XLI', 'XLU', 'XLB', 'XLRE', 'XLC',
  'SMH', 'SOXX', 'ARKK', 'JEPI', 'JEPQ', 'EFA', 'EEM', 'RSP', 'MDY', 'VB', 'VO',
]);

export function isEtf(ticker: string, meta: Record<string, TickerMeta>): boolean {
  const t = ticker.toUpperCase();
  return meta[t]?.type === 'etf' || KNOWN_ETFS.has(t);
}

export interface AssetMix {
  stocks: number;
  etfs: number;
  cash: number;
  total: number;
}

export function assetMix(
  positions: Position[],
  cash: number,
  prices: PriceCache,
  meta: Record<string, TickerMeta>,
): AssetMix {
  let stocks = 0;
  let etfs = 0;
  for (const p of positions) {
    const v = p.shares * priceOf(p.ticker, prices, p.avgCost);
    if (isEtf(p.ticker, meta)) etfs += v;
    else stocks += v;
  }
  const cashV = Math.max(cash, 0);
  return { stocks, etfs, cash: cashV, total: stocks + etfs + cashV };
}

export interface SectorRow {
  sector: string;
  value: number;
  weight: number; // among securities
  tickers: string[];
}

export function sectorBreakdown(
  positions: Position[],
  prices: PriceCache,
  meta: Record<string, TickerMeta>,
): { rows: SectorRow[]; untagged: string[] } {
  const bySector = new Map<string, { value: number; tickers: string[] }>();
  const untagged: string[] = [];
  let total = 0;

  for (const p of positions) {
    const t = p.ticker.toUpperCase();
    const v = p.shares * priceOf(p.ticker, prices, p.avgCost);
    if (v <= 0) continue;
    total += v;
    const sector = meta[t]?.sector ?? (isEtf(t, meta) ? 'ETF / Fund' : null);
    if (!sector) {
      untagged.push(t);
      continue;
    }
    const cur = bySector.get(sector) ?? { value: 0, tickers: [] };
    cur.value += v;
    cur.tickers.push(t);
    bySector.set(sector, cur);
  }

  const rows = [...bySector.entries()]
    .map(([sector, { value, tickers }]) => ({
      sector,
      value,
      weight: total > 0 ? value / total : 0,
      tickers,
    }))
    .sort((a, b) => b.value - a.value);
  return { rows, untagged };
}

// ---------- small stats helpers ----------

function avg(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function variance(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = avg(xs);
  return xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1);
}

function stddev(xs: number[]): number | null {
  const v = variance(xs);
  return v == null ? null : Math.sqrt(v);
}

function covariance(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const mx = avg(xs);
  const my = avg(ys);
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += (xs[i] - mx) * (ys[i] - my);
  return s / (xs.length - 1);
}
