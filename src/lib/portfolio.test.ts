import { describe, expect, it } from 'vitest';
import {
  benchmarkSeries,
  costBasis,
  diffPortfolios,
  portfolioValue,
  replayLedger,
  replayTrades,
  weights,
} from './portfolio';
import type { CashEvent, PriceSnapshot, Trade } from '../types';

const trade = (overrides: Partial<Trade>): Trade => ({
  id: Math.random().toString(36).slice(2),
  datetime: '2026-01-01T12:00:00.000Z',
  ticker: 'AAPL',
  side: 'buy',
  shares: 10,
  price: 100,
  fees: 0,
  decisionId: 'd1',
  createdAt: '2026-01-01T12:00:00.000Z',
  updatedAt: '2026-01-01T12:00:00.000Z',
  ...overrides,
});

describe('replayTrades', () => {
  it('builds a position and reduces cash on buy', () => {
    const state = replayTrades([trade({ shares: 10, price: 100, fees: 5 })], 10000);
    expect(state.positions).toHaveLength(1);
    expect(state.positions[0].shares).toBe(10);
    expect(state.positions[0].avgCost).toBeCloseTo(100.5); // fees folded into cost basis
    expect(state.cash).toBeCloseTo(8995);
  });

  it('weights avgCost across multiple buys', () => {
    const state = replayTrades(
      [
        trade({ shares: 10, price: 100 }),
        trade({ datetime: '2026-01-02T12:00:00.000Z', shares: 10, price: 200 }),
      ],
      10000,
    );
    expect(state.positions[0].shares).toBe(20);
    expect(state.positions[0].avgCost).toBeCloseTo(150);
  });

  it('keeps avgCost on partial sell and adds cash', () => {
    const state = replayTrades(
      [
        trade({ shares: 10, price: 100 }),
        trade({ datetime: '2026-01-02T12:00:00.000Z', side: 'sell', shares: 4, price: 120 }),
      ],
      10000,
    );
    expect(state.positions[0].shares).toBe(6);
    expect(state.positions[0].avgCost).toBeCloseTo(100);
    expect(state.cash).toBeCloseTo(10000 - 1000 + 480);
  });

  it('removes a position on full exit', () => {
    const state = replayTrades(
      [
        trade({ shares: 10, price: 100 }),
        trade({ datetime: '2026-01-02T12:00:00.000Z', side: 'sell', shares: 10, price: 90 }),
      ],
      10000,
    );
    expect(state.positions).toHaveLength(0);
    expect(state.cash).toBeCloseTo(10000 - 1000 + 900);
  });

  it('respects upTo exclusive vs inclusive', () => {
    const trades = [
      trade({ datetime: '2026-01-01T12:00:00.000Z', shares: 10 }),
      trade({ datetime: '2026-02-01T12:00:00.000Z', shares: 5 }),
    ];
    const exclusive = replayTrades(trades, 10000, '2026-02-01T12:00:00.000Z');
    expect(exclusive.positions[0].shares).toBe(10);
    const inclusive = replayTrades(trades, 10000, '2026-02-01T12:00:00.000Z', true);
    expect(inclusive.positions[0].shares).toBe(15);
  });

  it('normalizes ticker case', () => {
    const state = replayTrades(
      [trade({ ticker: 'aapl', shares: 5 }), trade({ ticker: 'AAPL', shares: 5, datetime: '2026-01-02T12:00:00.000Z' })],
      10000,
    );
    expect(state.positions).toHaveLength(1);
    expect(state.positions[0].shares).toBe(10);
  });
});

const cashEvent = (overrides: Partial<CashEvent>): CashEvent => ({
  id: Math.random().toString(36).slice(2),
  datetime: '2026-01-15T12:00:00.000Z',
  type: 'deposit',
  amount: 1000,
  createdAt: '2026-01-15T12:00:00.000Z',
  updatedAt: '2026-01-15T12:00:00.000Z',
  ...overrides,
});

describe('replayLedger', () => {
  it('applies deposits and withdrawals to cash and net deposits', () => {
    const result = replayLedger(
      [],
      [
        cashEvent({ type: 'deposit', amount: 5000 }),
        cashEvent({ datetime: '2026-02-01T12:00:00.000Z', type: 'withdrawal', amount: 2000 }),
      ],
      10000,
    );
    expect(result.cash).toBeCloseTo(13000);
    expect(result.netDeposits).toBeCloseTo(13000);
  });

  it('excludes cash events after the upTo cutoff', () => {
    const result = replayLedger(
      [],
      [cashEvent({ datetime: '2026-03-01T12:00:00.000Z', amount: 5000 })],
      10000,
      '2026-02-01T12:00:00.000Z',
    );
    expect(result.cash).toBeCloseTo(10000);
    expect(result.netDeposits).toBeCloseTo(10000);
  });

  it('records realized P/L per sell against avg cost at sale time', () => {
    const sellId = 'sell-1';
    const result = replayLedger(
      [
        trade({ shares: 10, price: 100 }),
        trade({ datetime: '2026-01-05T12:00:00.000Z', shares: 10, price: 200 }), // avg now 150
        trade({ id: sellId, datetime: '2026-01-10T12:00:00.000Z', side: 'sell', shares: 5, price: 180, fees: 2 }),
      ],
      [],
      20000,
    );
    expect(result.realizedByTrade[sellId]).toBeCloseTo((180 - 150) * 5 - 2);
    expect(result.realizedTotal).toBeCloseTo(148);
  });

  it('realized loss on a full exit below cost', () => {
    const sellId = 'sell-loss';
    const result = replayLedger(
      [
        trade({ ticker: 'INTC', shares: 40, price: 35 }),
        trade({ id: sellId, datetime: '2026-01-10T12:00:00.000Z', ticker: 'INTC', side: 'sell', shares: 40, price: 30 }),
      ],
      [],
      10000,
    );
    expect(result.realizedByTrade[sellId]).toBeCloseTo(-200);
    expect(result.positions).toHaveLength(0);
  });

  it('deposits do not inflate return math: value − netDeposits isolates performance', () => {
    const result = replayLedger(
      [trade({ shares: 10, price: 100 })],
      [cashEvent({ datetime: '2026-02-01T12:00:00.000Z', amount: 5000 })],
      10000,
    );
    const value = portfolioValue(result.positions, result.cash, { AAPL: 110 });
    // gain should be exactly the 10×$10 price move, not the $5k deposit
    expect(value - result.netDeposits).toBeCloseTo(100);
  });
});

describe('costBasis', () => {
  it('sums shares × avgCost over open positions', () => {
    expect(
      costBasis([
        { ticker: 'AAPL', shares: 10, avgCost: 100 },
        { ticker: 'VOO', shares: 2, avgCost: 480 },
      ]),
    ).toBeCloseTo(1960);
  });
});

describe('portfolioValue / weights', () => {
  it('values positions at given prices plus cash, avgCost fallback', () => {
    const positions = [
      { ticker: 'AAPL', shares: 10, avgCost: 100 },
      { ticker: 'MSFT', shares: 2, avgCost: 400 },
    ];
    const v = portfolioValue(positions, 1000, { AAPL: 110 });
    expect(v).toBeCloseTo(10 * 110 + 2 * 400 + 1000);
  });

  it('computes weights including cash in the denominator', () => {
    const positions = [{ ticker: 'AAPL', shares: 10, avgCost: 100 }];
    const w = weights(positions, 1000, { AAPL: { price: 100, fetchedAt: '' } });
    expect(w.AAPL).toBeCloseTo(1000 / 2000);
  });
});

const snap = (t: string, spy: number): PriceSnapshot => ({ t, prices: { SPY: spy } });

describe('benchmarkSeries', () => {
  it('returns empty when no benchmark or no benchmark prices', () => {
    expect(benchmarkSeries([], 1000, [snap('2026-01-01', 100)], undefined)).toEqual([]);
    expect(benchmarkSeries([], 1000, [{ t: '2026-01-01', prices: {} }], 'SPY')).toEqual([]);
  });

  it('grows the initial capital with the benchmark price', () => {
    const series = benchmarkSeries(
      [],
      1000,
      [snap('2026-01-01', 100), snap('2026-02-01', 120)],
      'SPY',
    );
    // 1000 / 100 = 10 units; at 120 → 1200
    expect(series[0].value).toBeCloseTo(1000);
    expect(series[1].value).toBeCloseTo(1200);
  });

  it('a later deposit buys units at the price on/after its date', () => {
    const deposit: CashEvent = {
      id: 'd', datetime: '2026-02-01T00:00:00.000Z', type: 'deposit', amount: 600,
      createdAt: '', updatedAt: '',
    };
    const series = benchmarkSeries(
      [deposit],
      1000,
      [snap('2026-01-01T00:00:00.000Z', 100), snap('2026-02-01T00:00:00.000Z', 120)],
      'SPY',
    );
    // start: 10 units. deposit 600 @120 = 5 units → 15 units × 120 = 1800
    expect(series[1].value).toBeCloseTo(1800);
  });

  it('a deposit before tracking uses the first snapshot price', () => {
    const deposit: CashEvent = {
      id: 'd', datetime: '2025-12-01T00:00:00.000Z', type: 'deposit', amount: 500,
      createdAt: '', updatedAt: '',
    };
    const series = benchmarkSeries(
      [deposit],
      1000,
      [snap('2026-01-01', 100), snap('2026-02-01', 110)],
      'SPY',
    );
    // (1000+500)/100 = 15 units; at 110 → 1650
    expect(series[1].value).toBeCloseTo(1650);
  });

  it('a withdrawal removes units', () => {
    const wd: CashEvent = {
      id: 'w', datetime: '2026-01-01T00:00:00.000Z', type: 'withdrawal', amount: 200,
      createdAt: '', updatedAt: '',
    };
    const series = benchmarkSeries([wd], 1000, [snap('2026-01-01T00:00:00.000Z', 100)], 'SPY');
    // 1000/100 - 200/100 = 8 units × 100 = 800
    expect(series[0].value).toBeCloseTo(800);
  });
});

describe('diffPortfolios', () => {
  const prices = {
    AAPL: { price: 100, fetchedAt: '' },
    NVDA: { price: 100, fetchedAt: '' },
    INTC: { price: 100, fetchedAt: '' },
    VOO: { price: 100, fetchedAt: '' },
  };

  it('classifies new, exit, increase, decrease, unchanged', () => {
    const before = {
      positions: [
        { ticker: 'INTC', shares: 10, avgCost: 100 },
        { ticker: 'AAPL', shares: 10, avgCost: 100 },
        { ticker: 'VOO', shares: 10, avgCost: 100 },
        { ticker: 'MSFT', shares: 4, avgCost: 100 },
      ],
      cash: 0,
    };
    const after = {
      positions: [
        { ticker: 'AAPL', shares: 14, avgCost: 100 },
        { ticker: 'VOO', shares: 10, avgCost: 100 },
        { ticker: 'NVDA', shares: 10, avgCost: 100 },
        { ticker: 'MSFT', shares: 2, avgCost: 100 },
      ],
      cash: 0,
    };
    const rows = diffPortfolios(before, after, prices);
    const byTicker = Object.fromEntries(rows.map((r) => [r.ticker, r.kind]));
    expect(byTicker.NVDA).toBe('new');
    expect(byTicker.INTC).toBe('exit');
    expect(byTicker.AAPL).toBe('increase');
    expect(byTicker.MSFT).toBe('decrease');
    expect(byTicker.VOO).toBe('unchanged');
  });

  it('handles empty before (first decision)', () => {
    const rows = diffPortfolios(
      { positions: [], cash: 1000 },
      { positions: [{ ticker: 'AAPL', shares: 10, avgCost: 100 }], cash: 0 },
      prices,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('new');
    expect(rows[0].weightBefore).toBe(0);
    expect(rows[0].weightAfter).toBeCloseTo(1);
  });
});
