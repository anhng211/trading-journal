import type { CashEvent, Decision, JournalData, PriceSnapshot, Trade } from '../types';
import { replayLedger } from './portfolio';

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};

interface DemoDecision {
  daysAgo: number;
  title: string;
  thesis: string;
  confidence: Decision['confidence'];
  tags: string[];
  expectedText: string;
  reviewByDaysAgo?: number;
  review?: Decision['review'];
  trades: Array<Pick<Trade, 'ticker' | 'side' | 'shares' | 'price' | 'fees'>>;
}

const DEMO: DemoDecision[] = [
  {
    daysAgo: 90,
    title: 'Build the core portfolio',
    thesis:
      'Start with a broad-market core (VOO) plus two satellites: AAPL for quality compounding, INTC as a cheap turnaround bet.',
    confidence: 4,
    tags: ['core', 'long-term'],
    expectedText: 'Beat cash over 12 months; INTC is the speculative sleeve.',
    trades: [
      { ticker: 'VOO', side: 'buy', shares: 20, price: 480, fees: 0 },
      { ticker: 'AAPL', side: 'buy', shares: 15, price: 220, fees: 0 },
      { ticker: 'INTC', side: 'buy', shares: 40, price: 35, fees: 0 },
    ],
  },
  {
    daysAgo: 45,
    title: 'Rotate INTC into NVDA',
    thesis:
      'The INTC turnaround thesis broke — foundry losses widening. Rotate the full position into NVDA: datacenter demand still under-modeled.',
    confidence: 4,
    tags: ['rotation', 'semis'],
    expectedText: 'NVDA outperforms INTC by 15%+ over the next 6 months.',
    reviewByDaysAgo: 15,
    review: {
      date: daysAgo(10),
      grade: 'A',
      notes:
        'Right call, right reason: INTC kept sliding, NVDA ran. Sizing was fine. Repeat: cut broken theses fast.',
    },
    trades: [
      { ticker: 'INTC', side: 'sell', shares: 40, price: 30, fees: 0 },
      { ticker: 'NVDA', side: 'buy', shares: 10, price: 120, fees: 0 },
    ],
  },
  {
    daysAgo: 14,
    title: 'Trim AAPL, start MSFT',
    thesis:
      'AAPL position grew past target weight and the next catalyst is months out. Recycle a third of it into MSFT for Azure/AI exposure.',
    confidence: 2,
    tags: ['trim', 'rebalance'],
    expectedText: 'MSFT roughly matches AAPL; this is a diversification trade, not alpha.',
    reviewByDaysAgo: -16, // review due ~2 weeks from now
    trades: [
      { ticker: 'AAPL', side: 'sell', shares: 5, price: 230, fees: 0 },
      { ticker: 'MSFT', side: 'buy', shares: 3, price: 420, fees: 0 },
    ],
  },
];

const SNAPSHOTS: Array<{ daysAgo: number; prices: Record<string, number> }> = [
  { daysAgo: 75, prices: { VOO: 485, AAPL: 222, INTC: 33, SPY: 528 } },
  { daysAgo: 60, prices: { VOO: 490, AAPL: 226, INTC: 31, SPY: 534 } },
  { daysAgo: 44, prices: { VOO: 492, AAPL: 224, INTC: 29.5, NVDA: 122, SPY: 536 } },
  { daysAgo: 30, prices: { VOO: 498, AAPL: 228, INTC: 27, NVDA: 128, SPY: 542 } },
  { daysAgo: 13, prices: { VOO: 503, AAPL: 231, INTC: 25.5, NVDA: 134, MSFT: 424, SPY: 548 } },
  { daysAgo: 7, prices: { VOO: 507, AAPL: 233, INTC: 24.8, NVDA: 138, MSFT: 428, SPY: 552 } },
  { daysAgo: 1, prices: { VOO: 510, AAPL: 235, INTC: 24, NVDA: 141, MSFT: 432, SPY: 555 } },
];

export function makeDemoData(): JournalData {
  const startingCash = 25000;
  const now = new Date().toISOString();
  const trades: Trade[] = [];
  const decisions: Decision[] = [];

  const cashEvents: CashEvent[] = [
    {
      id: crypto.randomUUID(),
      datetime: daysAgo(40),
      type: 'deposit',
      amount: 3000,
      note: 'Monthly savings top-up',
      createdAt: daysAgo(40),
      updatedAt: now,
    },
  ];

  for (const d of DEMO) {
    const datetime = daysAgo(d.daysAgo);
    const id = crypto.randomUUID();
    const ghost = replayLedger(trades, cashEvents, startingCash, datetime);

    decisions.push({
      id,
      datetime,
      title: d.title,
      thesis: d.thesis,
      confidence: d.confidence,
      tags: d.tags,
      expected: {
        text: d.expectedText,
        reviewBy: d.reviewByDaysAgo != null ? daysAgo(d.reviewByDaysAgo) : undefined,
      },
      review: d.review,
      ghostSnapshot: ghost.positions,
      ghostCash: ghost.cash,
      createdAt: datetime,
      updatedAt: now,
    });

    for (const t of d.trades) {
      trades.push({
        id: crypto.randomUUID(),
        datetime,
        decisionId: id,
        createdAt: datetime,
        updatedAt: now,
        ...t,
      });
    }
  }

  const priceSnapshots: PriceSnapshot[] = SNAPSHOTS.map((s) => ({
    t: daysAgo(s.daysAgo),
    prices: s.prices,
  }));

  const latest = SNAPSHOTS[SNAPSHOTS.length - 1];
  const prices = Object.fromEntries(
    Object.entries(latest.prices).map(([ticker, price]) => [
      ticker,
      { price, fetchedAt: daysAgo(latest.daysAgo), manual: true },
    ]),
  );

  const metaAt = daysAgo(1);
  const tickerMeta = {
    VOO: { sector: 'ETF / Fund', type: 'etf' as const, updatedAt: metaAt },
    AAPL: { sector: 'Technology', type: 'stock' as const, updatedAt: metaAt },
    NVDA: { sector: 'Semiconductors', type: 'stock' as const, updatedAt: metaAt },
    MSFT: { sector: 'Software', type: 'stock' as const, updatedAt: metaAt },
    INTC: { sector: 'Semiconductors', type: 'stock' as const, updatedAt: metaAt },
  };

  return {
    trades,
    decisions,
    cashEvents,
    settings: { startingCash, benchmarkTicker: 'SPY', riskFreeRate: 4 },
    prices,
    priceSnapshots,
    tickerMeta,
  };
}
