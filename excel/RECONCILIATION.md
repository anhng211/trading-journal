# Reconciliation — Excel workbook vs the Trading & Investment Journal app

Both the workbook and the app were loaded with the **same demo dataset** (3 decisions, 7 trades,
1 deposit, 7 price snapshots, anchor date 2026-07-01). App values below were read from the app UI
(verified in the browser on 2026-07-01); workbook values are computed live by Excel formulas.
The workbook's **Reconciliation sheet** performs these comparisons with live links and PASS/CHECK status cells.

## Value-by-value comparison

| Metric | App screen | App shows | Workbook formula computes | Match |
|---|---|---:|---:|:--:|
| Portfolio value | Dashboard | $28,846 | $28,846 | ✅ |
| Free funds (cash) | Dashboard | $13,590 | $13,590 | ✅ |
| Invested (cost basis) | Dashboard | $14,260 | $14,260 | ✅ |
| Unrealized P/L | Dashboard | +$996 | +$996 | ✅ |
| Realized P/L | Dashboard | −$150 | −$150 (INTC −$200, AAPL +$50) | ✅ |
| Net deposits | Dashboard | $28,000 | $28,000 ($25,000 initial + $3,000 deposit) | ✅ |
| Total return | Dashboard | +$846 (+3.0%) | +$846 (+3.02%) | ✅ |
| All decisions vs doing nothing | Dashboard | +$846 | +$846 (385 + 450 + 11) | ✅ |
| D-001 vs doing nothing | Decisions list | +1.5% | +1.54% (+$385) | ✅ |
| D-002 decision value | Decision detail | +$450 (+1.8%) | +$450 (+1.77%) | ✅ |
| D-003 vs doing nothing | Decisions list | +0.0% | +0.04% (+$11) | ✅ |
| Allocation VOO / AAPL / NVDA / MSFT / Cash | Donut | 35.4 / 8.1 / 4.9 / 4.5 / 47.1% | 35.36 / 8.15 / 4.89 / 4.49 / 47.11% | ✅ |
| Sharpe ratio | X-Ray | 5.58 | 5.5796 | ✅ |
| Beta | X-Ray | 0.74 | 0.7396 | ✅ |
| Alpha (annualized) | X-Ray | −6.1% | −6.13% | ✅ |
| Volatility (annualized) | X-Ray | 1.9% | 1.88% | ✅ |
| Max drawdown | X-Ray | −0.0% | −0.04% | ✅ |
| R² | X-Ray | 51% | 50.6% | ✅ |
| Annualized return (TWR) | X-Ray | +15.6% | +15.55% | ✅ |
| Benchmark annualized return | X-Ray | +27.9% | +27.91% | ✅ |
| Positions / Effective holdings | X-Ray | 4 / 2.1 | 4 / 2.056 | ✅ |
| Largest position / Top 3 | X-Ray | 66.9% / 91.5% | 66.86% / 91.50% | ✅ |
| Sectors ETF/Tech/Semis/Software | X-Ray | 66.9 / 15.4 / 9.2 / 8.5% | 66.86 / 15.40 / 9.24 / 8.50% | ✅ |

Differences are display rounding only (the app rounds to 1 decimal / whole dollars).

## Method mapping — where each app calculation lives in Excel

| App source (code) | What it does | Workbook equivalent |
|---|---|---|
| `replayLedger()` — src/lib/portfolio.ts | Replays trades + cash events into positions, cash, realized P/L, net deposits | **Trades** I:L (signed shares, cash flow, realized P/L via SUMPRODUCT weighted-average cost), **CashEvents** E, **Snapshots** M:W (SUMIFS "as of date") |
| `portfolioValue()`, `costBasis()` | Values positions at prices; cost basis | **Dashboard** holdings table (SUMIFS × price), row 25 totals |
| `decisionOutcome()` | Ghost (portfolio just *before* the decision) vs Acted (just *after*), both valued at **current** prices — "was it better than doing nothing?" | **Decisions** J:M — ledger SUMIFS with `<` (ghost) vs `<=` (acted) against the decision date, valued via array-SUMIFS × Prices |
| `intervalReturns()` — src/lib/analytics.ts | Flow-adjusted time-weighted return per snapshot interval: `r = (V₁ − flow) / V₀ − 1` | **Snapshots** Y (net flow), Z (portfolio return), AA (benchmark return) |
| `riskStats()` | Annualized by observed frequency: `ppy = n / spanYears`; vol = sd×√ppy; Sharpe = (mean − rf/ppy)/sd×√ppy; CAGR from chained TWR index; max drawdown from running peak; Beta/R² regression vs benchmark; Jensen alpha | **XRay** B4:B17 — COUNT, AVERAGE, STDEV.S, SLOPE, RSQ over OFFSET ranges; index/peak/drawdown columns AB:AE on Snapshots |
| `concentration()` | Weights among securities, 1/Herfindahl effective holdings, top-1/top-3 | **XRay** B20:B23 + weights helper D28:E37 (SUMSQ, LARGE, MAX) |
| `sectorBreakdown()` | Sector weights among securities | **XRay** sector table (SUMIFS over Dashboard values by sector) |
| Trading 212-style funds tracking | Total return measured against net deposits — deposits never count as gains | **Dashboard** B9:B11 |

## Assumptions & known differences

1. **Dates** — the app regenerates demo dates relative to "today"; the workbook fixes them to
   anchor 2026-07-01 with identical day-offsets, so every statistic matches exactly.
2. **Display rounding** — "App shows" values are UI-rounded; workbook tolerances (±$1, ±0.15pp,
   ±0.05 on ratios) cover rounding only.
3. **Ghost values** — the app freezes each decision's ghost snapshot at creation; the workbook
   recomputes it from the ledger. Equivalent for normal decisions. The app's synthetic
   "Opening portfolio" forces an all-cash ghost; in the workbook an opening decision's ghost is
   starting cash — the same thing.
4. **Cost basis** — exact when all buys precede sells per ticker (true for the demo and most use).
   Buying again after a partial sell approximates avg cost at later sales; the app computes the
   sequential weighted average.
5. **Same-day ordering** — the workbook splits ghost/acted by date (`<` vs `<=`); the app uses
   timestamps. Keep one decision per date.
6. **Snapshot collapsing** — the app merges price refreshes within 30 minutes into one snapshot;
   in the workbook, every Snapshots row is one observation.
