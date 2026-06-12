import { create } from 'zustand';
import type {
  Confidence,
  Decision,
  Expected,
  JournalData,
  Review,
  Settings,
  Trade,
} from '../types';
import { emptyJournal } from '../types';
import { LocalStorageAdapter, type StorageAdapter } from './storage';
import { replayTrades } from '../lib/portfolio';
import { fetchQuotes } from '../lib/prices';

const adapter: StorageAdapter = new LocalStorageAdapter();

export interface TradeInput {
  ticker: string;
  side: 'buy' | 'sell';
  shares: number;
  price: number;
  fees: number;
  note?: string;
}

export interface DecisionInput {
  datetime: string;
  title: string;
  thesis: string;
  confidence: Confidence;
  tags: string[];
  expected: Expected;
  trades: TradeInput[];
}

interface JournalStore extends JournalData {
  refreshing: boolean;
  refreshError?: string;

  addDecision(input: DecisionInput): string;
  deleteDecision(id: string): void;
  saveReview(decisionId: string, review: Review): void;
  setSettings(patch: Partial<Settings>): void;
  setManualPrice(ticker: string, price: number): void;
  refreshPrices(): Promise<void>;
  exportJSON(): string;
  importJSON(json: string): boolean;
  loadData(data: JournalData): void;
  resetAll(): void;
}

const persist = (state: JournalStore) => {
  const { trades, decisions, settings, prices, priceSnapshots } = state;
  adapter.save({ trades, decisions, settings, prices, priceSnapshots });
};

export const useJournal = create<JournalStore>((set, get) => ({
  ...adapter.load(),
  refreshing: false,

  addDecision(input) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const state = get();

    // Freeze the pre-decision portfolio: this is the "ghost" the
    // counterfactual chart compares against.
    const ghost = replayTrades(state.trades, state.settings.startingCash, input.datetime);

    const trades: Trade[] = input.trades.map((t) => ({
      id: crypto.randomUUID(),
      datetime: input.datetime,
      ticker: t.ticker.toUpperCase(),
      side: t.side,
      shares: t.shares,
      price: t.price,
      fees: t.fees,
      note: t.note,
      decisionId: id,
      createdAt: now,
      updatedAt: now,
    }));

    const decision: Decision = {
      id,
      datetime: input.datetime,
      title: input.title,
      thesis: input.thesis,
      confidence: input.confidence,
      tags: input.tags,
      expected: input.expected,
      ghostSnapshot: ghost.positions,
      ghostCash: ghost.cash,
      createdAt: now,
      updatedAt: now,
    };

    set((s) => ({ decisions: [...s.decisions, decision], trades: [...s.trades, ...trades] }));
    persist(get());
    return id;
  },

  deleteDecision(id) {
    set((s) => ({
      decisions: s.decisions.filter((d) => d.id !== id),
      trades: s.trades.filter((t) => t.decisionId !== id),
    }));
    persist(get());
  },

  saveReview(decisionId, review) {
    const now = new Date().toISOString();
    set((s) => ({
      decisions: s.decisions.map((d) =>
        d.id === decisionId ? { ...d, review, updatedAt: now } : d,
      ),
    }));
    persist(get());
  },

  setSettings(patch) {
    set((s) => ({ settings: { ...s.settings, ...patch } }));
    persist(get());
  },

  setManualPrice(ticker, price) {
    const t = ticker.toUpperCase();
    const now = new Date().toISOString();
    set((s) => ({
      prices: { ...s.prices, [t]: { price, fetchedAt: now, manual: true } },
      priceSnapshots: appendSnapshot(s.priceSnapshots, now, {
        ...latestPrices(s),
        [t]: price,
      }),
    }));
    persist(get());
  },

  async refreshPrices() {
    const state = get();
    const key = state.settings.finnhubKey;
    if (!key) {
      set({ refreshError: 'No Finnhub API key set — add one in Settings or enter prices manually.' });
      return;
    }
    const tickers = [...new Set(state.trades.map((t) => t.ticker))];
    if (tickers.length === 0) return;

    set({ refreshing: true, refreshError: undefined });
    const results = await fetchQuotes(tickers, key);
    const now = new Date().toISOString();
    const failed = results.filter((r) => r.price == null);

    set((s) => {
      const prices = { ...s.prices };
      for (const r of results) {
        if (r.price != null) prices[r.ticker] = { price: r.price, fetchedAt: now };
      }
      const batch: Record<string, number> = {};
      for (const [ticker, entry] of Object.entries(prices)) batch[ticker] = entry.price;
      return {
        prices,
        priceSnapshots: appendSnapshot(s.priceSnapshots, now, batch),
        refreshing: false,
        refreshError: failed.length
          ? `No quote for: ${failed.map((f) => f.ticker).join(', ')}`
          : undefined,
      };
    });
    persist(get());
  },

  exportJSON() {
    const { trades, decisions, settings, prices, priceSnapshots } = get();
    return JSON.stringify({ trades, decisions, settings, prices, priceSnapshots }, null, 2);
  },

  importJSON(json) {
    try {
      const parsed = JSON.parse(json) as Partial<JournalData>;
      if (!Array.isArray(parsed.trades) || !Array.isArray(parsed.decisions)) return false;
      const data: JournalData = { ...emptyJournal(), ...parsed };
      set(data);
      persist(get());
      return true;
    } catch {
      return false;
    }
  },

  loadData(data) {
    set(data);
    persist(get());
  },

  resetAll() {
    set(emptyJournal());
    persist(get());
  },
}));

function latestPrices(s: JournalData): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [ticker, entry] of Object.entries(s.prices)) out[ticker] = entry.price;
  return out;
}

/** Collapse snapshots taken within 30 minutes of each other to keep storage small. */
function appendSnapshot(
  snapshots: JournalData['priceSnapshots'],
  t: string,
  prices: Record<string, number>,
) {
  const last = snapshots[snapshots.length - 1];
  if (last && new Date(t).getTime() - new Date(last.t).getTime() < 30 * 60 * 1000) {
    return [...snapshots.slice(0, -1), { t, prices: { ...last.prices, ...prices } }];
  }
  return [...snapshots, { t, prices }];
}
