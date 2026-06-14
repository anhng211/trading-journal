export interface Trade {
  id: string;
  datetime: string; // ISO
  ticker: string;
  side: 'buy' | 'sell';
  shares: number;
  price: number;
  fees: number;
  decisionId: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export type Confidence = 1 | 2 | 3 | 4 | 5;
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface Expected {
  text: string;
  priceTargets?: Record<string, number>;
  reviewBy?: string; // ISO date
}

export interface Review {
  date: string;
  grade: Grade;
  notes: string;
}

export interface Position {
  ticker: string;
  shares: number;
  avgCost: number;
}

export interface Decision {
  id: string;
  datetime: string; // ISO
  title: string;
  thesis: string;
  confidence: Confidence;
  tags: string[];
  expected: Expected;
  review?: Review;
  /** Frozen pre-decision holdings + cash, so the counterfactual is stable. */
  ghostSnapshot: Position[];
  ghostCash: number;
  /** 'opening' = synthetic baseline created at onboarding (not a predicted decision). */
  kind?: 'opening';
  createdAt: string;
  updatedAt: string;
}

/** A deposit or withdrawal of cash, independent of any trade. */
export interface CashEvent {
  id: string;
  datetime: string; // ISO
  type: 'deposit' | 'withdrawal';
  amount: number; // always positive; type carries the sign
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  finnhubKey?: string;
  /** Cash at inception, before any trades or cash events. */
  startingCash: number;
  /** Ticker the equity curve is benchmarked against (e.g. SPY). */
  benchmarkTicker?: string;
}

export interface PriceEntry {
  price: number;
  fetchedAt: string;
  manual?: boolean;
}
export type PriceCache = Record<string, PriceEntry>;

/** One batch of quotes recorded at refresh time; powers ghost/equity charts. */
export interface PriceSnapshot {
  t: string; // ISO
  prices: Record<string, number>;
}

export interface JournalData {
  trades: Trade[];
  decisions: Decision[];
  cashEvents: CashEvent[];
  settings: Settings;
  prices: PriceCache;
  priceSnapshots: PriceSnapshot[];
}

export const emptyJournal = (): JournalData => ({
  trades: [],
  decisions: [],
  cashEvents: [],
  settings: { startingCash: 10000, benchmarkTicker: 'SPY' },
  prices: {},
  priceSnapshots: [],
});
