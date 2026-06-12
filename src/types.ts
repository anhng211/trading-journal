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
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  finnhubKey?: string;
  startingCash: number;
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
  settings: Settings;
  prices: PriceCache;
  priceSnapshots: PriceSnapshot[];
}

export const emptyJournal = (): JournalData => ({
  trades: [],
  decisions: [],
  settings: { startingCash: 10000 },
  prices: {},
  priceSnapshots: [],
});
