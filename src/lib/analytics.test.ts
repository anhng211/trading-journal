import { describe, expect, it } from 'vitest';
import {
  concentration,
  intervalReturns,
  riskStats,
  type IntervalReturn,
} from './analytics';
import type { CashEvent, PriceSnapshot, Trade } from '../types';

const day = (i: number) => new Date(Date.UTC(2026, 0, 1 + i, 12)).toISOString();

const trade = (overrides: Partial<Trade>): Trade => ({
  id: Math.random().toString(36).slice(2),
  datetime: day(-10),
  ticker: 'AAA',
  side: 'buy',
  shares: 10,
  price: 10,
  fees: 0,
  decisionId: 'd1',
  createdAt: day(-10),
  updatedAt: day(-10),
  ...overrides,
});

const deposit = (datetime: string, amount: number): CashEvent => ({
  id: Math.random().toString(36).slice(2),
  datetime,
  type: 'deposit',
  amount,
  createdAt: datetime,
  updatedAt: datetime,
});

/** Synthetic intervals with daily spacing for direct riskStats tests. */
const intervals = (rps: number[], rbs?: (number | null)[]): IntervalReturn[] =>
  rps.map((rp, i) => ({ t0: day(i), t1: day(i + 1), rp, rb: rbs ? rbs[i] : null }));

describe('intervalReturns', () => {
  it('computes snapshot-to-snapshot portfolio returns', () => {
    const trades = [trade({})]; // 10 shares @ $10, startingCash 100 → cash 0
    const snaps: PriceSnapshot[] = [
      { t: day(0), prices: { AAA: 10 } },
      { t: day(1), prices: { AAA: 11 } },
    ];
    const out = intervalReturns(trades, [], 100, snaps);
    expect(out).toHaveLength(1);
    expect(out[0].rp).toBeCloseTo(0.1);
  });

  it('excludes deposits from returns (time-weighted)', () => {
    const trades = [trade({})];
    const snaps: PriceSnapshot[] = [
      { t: day(0), prices: { AAA: 10 } },
      { t: day(2), prices: { AAA: 11 } },
    ];
    const out = intervalReturns(trades, [deposit(day(1), 20)], 100, snaps);
    // value went 100 → 130, but 20 of that is a deposit: return is still 10%
    expect(out[0].rp).toBeCloseTo(0.1);
  });

  it('pairs benchmark returns when the benchmark price is in both snapshots', () => {
    const trades = [trade({})];
    const snaps: PriceSnapshot[] = [
      { t: day(0), prices: { AAA: 10, SPY: 100 } },
      { t: day(1), prices: { AAA: 10.5, SPY: 102 } },
      { t: day(2), prices: { AAA: 10.5 } }, // SPY missing → rb null
    ];
    const out = intervalReturns(trades, [], 100, snaps, 'SPY');
    expect(out[0].rb).toBeCloseTo(0.02);
    expect(out[1].rb).toBeNull();
  });
});

describe('riskStats', () => {
  it('returns null below the minimum number of observations', () => {
    expect(riskStats(intervals([0.01, 0.02, -0.01]))).toBeNull();
  });

  it('recovers beta≈2 and R²≈1 when the portfolio moves exactly 2× the benchmark', () => {
    const rb = [0.01, -0.02, 0.03, -0.01, 0.02, 0.015];
    const rp = rb.map((r) => 2 * r);
    const stats = riskStats(intervals(rp, rb), 0);
    expect(stats).not.toBeNull();
    expect(stats!.beta).toBeCloseTo(2, 6);
    expect(stats!.r2).toBeCloseTo(1, 6);
  });

  it('computes max drawdown from the chained index', () => {
    const stats = riskStats(intervals([0.1, -0.2, 0.05, 0.01, -0.01]), 0);
    expect(stats!.maxDrawdown).toBeCloseTo(-0.2, 6);
  });

  it('sharpe is positive when returns beat the risk-free rate', () => {
    const stats = riskStats(intervals([0.01, 0.012, 0.008, 0.011, 0.009, 0.01]), 0);
    expect(stats!.sharpe).not.toBeNull();
    expect(stats!.sharpe!).toBeGreaterThan(0);
  });

  it('flat benchmark yields no beta instead of dividing by zero', () => {
    const rb = [0, 0, 0, 0, 0, 0];
    const rp = [0.01, -0.01, 0.02, 0.005, -0.002, 0.01];
    const stats = riskStats(intervals(rp, rb), 0);
    expect(stats!.beta).toBeNull();
  });
});

describe('concentration', () => {
  it('equal weights give effectiveN = count', () => {
    const c = concentration(
      [
        { ticker: 'A', shares: 1, avgCost: 100 },
        { ticker: 'B', shares: 1, avgCost: 100 },
        { ticker: 'C', shares: 1, avgCost: 100 },
        { ticker: 'D', shares: 1, avgCost: 100 },
      ],
      {},
    );
    expect(c!.count).toBe(4);
    expect(c!.effectiveN).toBeCloseTo(4);
    expect(c!.top1).toBeCloseTo(0.25);
  });

  it('a dominant position collapses effectiveN toward 1', () => {
    const c = concentration(
      [
        { ticker: 'A', shares: 90, avgCost: 100 },
        { ticker: 'B', shares: 10, avgCost: 100 },
      ],
      {},
    );
    expect(c!.top1).toBeCloseTo(0.9);
    expect(c!.effectiveN).toBeLessThan(1.3);
  });
});
