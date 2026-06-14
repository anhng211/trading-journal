import type { CashEvent, Decision, Position, PriceCache, PriceSnapshot, Settings, Trade } from '../types';

const EPS = 1e-9;

export interface PortfolioState {
  positions: Position[];
  cash: number;
}

export interface LedgerResult extends PortfolioState {
  /** Realized P/L per sell trade id: (sale price − avg cost) × shares − fees. */
  realizedByTrade: Record<string, number>;
  realizedTotal: number;
  /** startingCash + deposits − withdrawals, up to the same cutoff. */
  netDeposits: number;
}

/**
 * Replay trades and cash events (sorted by datetime) into positions, cash,
 * realized P/L, and net deposits. `upTo` (ISO, exclusive by default) limits
 * the replay — used to derive the portfolio as it stood just before a decision.
 */
export function replayLedger(
  trades: Trade[],
  cashEvents: CashEvent[],
  startingCash: number,
  upTo?: string,
  inclusive = false,
): LedgerResult {
  const cutoff = (datetime: string) =>
    !!upTo && (inclusive ? datetime > upTo : datetime >= upTo);

  const map = new Map<string, Position>();
  let cash = startingCash;
  let netDeposits = startingCash;
  const realizedByTrade: Record<string, number> = {};
  let realizedTotal = 0;

  for (const e of [...cashEvents].sort((a, b) => a.datetime.localeCompare(b.datetime))) {
    if (cutoff(e.datetime)) break;
    const signed = e.type === 'deposit' ? e.amount : -e.amount;
    cash += signed;
    netDeposits += signed;
  }

  for (const t of [...trades].sort((a, b) => a.datetime.localeCompare(b.datetime))) {
    if (cutoff(t.datetime)) break;
    const ticker = t.ticker.toUpperCase();
    const pos = map.get(ticker) ?? { ticker, shares: 0, avgCost: 0 };

    if (t.side === 'buy') {
      const totalCost = pos.shares * pos.avgCost + t.shares * t.price + t.fees;
      pos.shares += t.shares;
      pos.avgCost = pos.shares > EPS ? totalCost / pos.shares : 0;
      cash -= t.shares * t.price + t.fees;
    } else {
      const realized = (t.price - pos.avgCost) * t.shares - t.fees;
      realizedByTrade[t.id] = realized;
      realizedTotal += realized;
      pos.shares -= t.shares;
      cash += t.shares * t.price - t.fees;
      if (pos.shares <= EPS) {
        pos.shares = 0;
      }
    }

    if (pos.shares <= EPS) map.delete(ticker);
    else map.set(ticker, pos);
  }

  return { positions: [...map.values()], cash, realizedByTrade, realizedTotal, netDeposits };
}

/** Trades-only replay; kept for callers that don't deal in cash events. */
export function replayTrades(
  trades: Trade[],
  startingCash: number,
  upTo?: string,
  inclusive = false,
): PortfolioState {
  const { positions, cash } = replayLedger(trades, [], startingCash, upTo, inclusive);
  return { positions, cash };
}

/** Total cost basis of open positions (what's currently invested). */
export function costBasis(positions: Position[]): number {
  return positions.reduce((sum, p) => sum + p.shares * p.avgCost, 0);
}

export function priceOf(ticker: string, prices: PriceCache, fallback: number): number {
  const entry = prices[ticker.toUpperCase()];
  return entry ? entry.price : fallback;
}

/** Market value of positions + cash, falling back to avgCost when no price is known. */
export function portfolioValue(
  positions: Position[],
  cash: number,
  prices: PriceCache | Record<string, number>,
): number {
  const lookup = (ticker: string, fallback: number): number => {
    const entry = (prices as Record<string, unknown>)[ticker.toUpperCase()];
    if (entry == null) return fallback;
    return typeof entry === 'number' ? entry : (entry as { price: number }).price;
  };
  return positions.reduce((sum, p) => sum + p.shares * lookup(p.ticker, p.avgCost), cash);
}

/** Weight (0..1) of each holding within the portfolio (cash included in denominator). */
export function weights(
  positions: Position[],
  cash: number,
  prices: PriceCache,
): Record<string, number> {
  const total = portfolioValue(positions, cash, prices);
  const out: Record<string, number> = {};
  for (const p of positions) {
    const v = p.shares * priceOf(p.ticker, prices, p.avgCost);
    out[p.ticker] = total > EPS ? v / total : 0;
  }
  return out;
}

export type DiffKind = 'new' | 'exit' | 'increase' | 'decrease' | 'unchanged';

export interface DiffRow {
  ticker: string;
  kind: DiffKind;
  sharesBefore: number;
  sharesAfter: number;
  weightBefore: number; // 0..1
  weightAfter: number; // 0..1
}

/** Structural diff between two portfolio states — the "git diff" of a decision. */
export function diffPortfolios(
  before: PortfolioState,
  after: PortfolioState,
  prices: PriceCache,
): DiffRow[] {
  const wBefore = weights(before.positions, before.cash, prices);
  const wAfter = weights(after.positions, after.cash, prices);
  const beforeMap = new Map(before.positions.map((p) => [p.ticker, p]));
  const afterMap = new Map(after.positions.map((p) => [p.ticker, p]));
  const tickers = [...new Set([...beforeMap.keys(), ...afterMap.keys()])];

  const rows: DiffRow[] = tickers.map((ticker) => {
    const b = beforeMap.get(ticker);
    const a = afterMap.get(ticker);
    const sharesBefore = b?.shares ?? 0;
    const sharesAfter = a?.shares ?? 0;
    let kind: DiffKind;
    if (sharesBefore <= EPS && sharesAfter > EPS) kind = 'new';
    else if (sharesBefore > EPS && sharesAfter <= EPS) kind = 'exit';
    else if (Math.abs(sharesAfter - sharesBefore) <= EPS) kind = 'unchanged';
    else kind = sharesAfter > sharesBefore ? 'increase' : 'decrease';
    return {
      ticker,
      kind,
      sharesBefore,
      sharesAfter,
      weightBefore: wBefore[ticker] ?? 0,
      weightAfter: wAfter[ticker] ?? 0,
    };
  });

  const order: Record<DiffKind, number> = { new: 0, increase: 1, decrease: 2, exit: 3, unchanged: 4 };
  return rows.sort(
    (x, y) => order[x.kind] - order[y.kind] || y.weightAfter - x.weightAfter,
  );
}

/**
 * The two frozen portfolios a decision compares:
 * - ghost: holdings just before the decision (stored on the decision)
 * - acted: holdings just after the decision's trades executed
 * Neither includes later decisions, so the comparison isolates this decision.
 */
export function decisionPortfolios(
  decision: Decision,
  trades: Trade[],
  cashEvents: CashEvent[],
  settings: Settings,
): { ghost: PortfolioState; acted: PortfolioState } {
  const ghost: PortfolioState = {
    positions: decision.ghostSnapshot,
    cash: decision.ghostCash,
  };
  const acted = replayLedger(trades, cashEvents, settings.startingCash, decision.datetime, true);
  return { ghost, acted: { positions: acted.positions, cash: acted.cash } };
}

export interface DecisionOutcome {
  ghostValue: number;
  actedValue: number;
  delta: number; // dollars: acted − ghost at current prices
  pct: number; // delta / ghostValue
}

/** "What you did" vs "if you'd done nothing", valued at current prices. */
export function decisionOutcome(
  decision: Decision,
  trades: Trade[],
  cashEvents: CashEvent[],
  settings: Settings,
  prices: PriceCache,
): DecisionOutcome {
  const { ghost, acted } = decisionPortfolios(decision, trades, cashEvents, settings);
  const ghostValue = portfolioValue(ghost.positions, ghost.cash, prices);
  const actedValue = portfolioValue(acted.positions, acted.cash, prices);
  const delta = actedValue - ghostValue;
  return { ghostValue, actedValue, delta, pct: ghostValue > EPS ? delta / ghostValue : 0 };
}

export interface GhostPoint {
  t: string;
  acted: number;
  ghost: number;
}

/**
 * Time series for the ghost chart: both frozen portfolios valued at each
 * recorded price snapshot after the decision, anchored at the decision's
 * execution prices and ending at the latest cached prices.
 */
export function ghostSeries(
  decision: Decision,
  trades: Trade[],
  cashEvents: CashEvent[],
  settings: Settings,
  prices: PriceCache,
  snapshots: PriceSnapshot[],
): GhostPoint[] {
  const { ghost, acted } = decisionPortfolios(decision, trades, cashEvents, settings);

  // Anchor: at execution, value both portfolios at the decision's trade
  // prices (avgCost fallback for untouched holdings) — they differ only by fees.
  const decisionTrades = trades.filter((t) => t.decisionId === decision.id);
  const anchorPrices: Record<string, number> = {};
  for (const t of decisionTrades) anchorPrices[t.ticker] = t.price;
  const points: GhostPoint[] = [
    {
      t: decision.datetime,
      acted: portfolioValue(acted.positions, acted.cash, anchorPrices),
      ghost: portfolioValue(ghost.positions, ghost.cash, anchorPrices),
    },
  ];

  for (const snap of snapshots) {
    if (snap.t <= decision.datetime) continue;
    points.push({
      t: snap.t,
      acted: portfolioValue(acted.positions, acted.cash, snap.prices),
      ghost: portfolioValue(ghost.positions, ghost.cash, snap.prices),
    });
  }

  const hasCurrent = Object.keys(prices).length > 0;
  if (hasCurrent) {
    const now = new Date().toISOString();
    const last = points[points.length - 1];
    if (!last || now > last.t) {
      points.push({
        t: now,
        acted: portfolioValue(acted.positions, acted.cash, prices),
        ghost: portfolioValue(ghost.positions, ghost.cash, prices),
      });
    }
  }
  return points;
}

export interface BenchmarkPoint {
  t: string;
  value: number;
}

/**
 * "What if the same money went into the index instead?" — money-weighted.
 * Each cash inflow (initial capital + deposits − withdrawals) buys/sells
 * benchmark UNITS at the benchmark price of the first snapshot on/after its
 * date (flows before tracking started use the first snapshot price). Benchmark
 * value at snapshot t = units(t) × benchPrice(t). Builds forward from the
 * snapshots we have (free tier has no historical backfill).
 */
export function benchmarkSeries(
  cashEvents: CashEvent[],
  startingCash: number,
  snapshots: PriceSnapshot[],
  benchmarkTicker?: string,
): BenchmarkPoint[] {
  if (!benchmarkTicker) return [];
  const sym = benchmarkTicker.toUpperCase();
  const benchSnaps = snapshots
    .filter((s) => s.prices[sym] != null && s.prices[sym] > 0)
    .sort((a, b) => a.t.localeCompare(b.t));
  if (benchSnaps.length === 0) return [];

  const firstPrice = benchSnaps[0].prices[sym];
  const priceAtOrAfter = (date: string): number => {
    const snap = benchSnaps.find((s) => s.t >= date);
    return snap ? snap.prices[sym] : benchSnaps[benchSnaps.length - 1].prices[sym];
  };

  const flows: { date: string; amount: number }[] = [
    { date: benchSnaps[0].t, amount: startingCash },
    ...cashEvents.map((e) => ({
      date: e.datetime,
      amount: e.type === 'deposit' ? e.amount : -e.amount,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return benchSnaps.map((snap) => {
    let units = 0;
    for (const f of flows) {
      if (f.date <= snap.t) {
        const entryPrice = f.date < benchSnaps[0].t ? firstPrice : priceAtOrAfter(f.date);
        units += f.amount / entryPrice;
      }
    }
    return { t: snap.t, value: units * snap.prices[sym] };
  });
}
