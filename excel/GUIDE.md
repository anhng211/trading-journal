# Trading & Investment Journal — Excel Workbook Guide (Procedures)

The workbook `Trading-Investment-Journal.xlsx` is a formula-driven twin of the web app
(https://anhng211.github.io/trading-journal/). Every number is calculated live by Excel from
your inputs — nothing is hardcoded. It ships pre-loaded with the app's demo dataset so you can
see every formula working and reconcile it against the app before entering your own data.

## Conventions

| Style | Meaning |
|---|---|
| **Blue text** | Inputs — you type these |
| **Black text** | Calculated — do not edit |
| **Green text** (Reconciliation) | Links pulling from other sheets |
| **Yellow fill** | Editable slot headers / key assumptions |

- Dates: `YYYY-MM-DD`.
- Keep **one decision per date** (the app orders by timestamp; the workbook splits before/after by date).
- Starting fresh: clear the blue data rows on **Decisions**, **Trades**, **CashEvents**, **Snapshots**
  (keep headers and calculated columns), then set **Settings** and **Prices** to your own.

## P1 — One-time setup

1. **Settings**: enter *Starting cash* (cash at inception), *Benchmark ticker* (SPY recommended),
   *Risk-free rate* (used by the Sharpe ratio).
2. **Prices**: one row per ticker you own or track — current price, sector, type (`stock`/`etf`).
   The benchmark needs a row too.
3. Already own holdings? Add one **Buy** row per holding on **Trades** (dated when bought, or today
   at your average cost), all under a single Decision ID (e.g. `D-000`), plus a matching
   "Opening portfolio" row on **Decisions**. This mirrors the app's *Set up your portfolio*: the
   opening decision's ghost value equals starting cash, so it reads "your holdings vs staying in cash."

## P2 — Record a decision (the core loop)

1. **Decisions**: add a row — next ID (`D-004`, `D-005`…), date, title, confidence 1–5, tags,
   your thesis, and what you expect to happen.
2. **Trades**: one row per executed trade with the **same Decision ID and date**.
3. Read the decision row's calculated columns: **Ghost value** (portfolio if you had done nothing),
   **Acted value** (portfolio after the trades), **Decision value** ($ and %) — all at current prices.

## P3 — Record deposits & withdrawals

- **CashEvents**: date, type (`Deposit`/`Withdrawal`), amount, note. Never put trades here.
  Deposits are excluded from returns — adding money never counts as gains.

## P4 — Update prices (weekly routine; this grows your statistics)

1. **Prices**: update *Current price* for every ticker, including the benchmark.
2. **Snapshots**: add **one row** directly under the last filled row (no gaps): date, price per
   ticker column, benchmark price. Shares/cash/value/returns compute automatically (prefilled to row 40).
3. Risk statistics appear from 6 snapshots and firm up as history grows — identical to the app,
   where each *Refresh prices* records one snapshot.
4. Past row 40: fill the last row's formulas (columns M–AE) downward and extend the Dashboard chart range.

## P5 — Read the Dashboard

- Account block: Portfolio value, Free funds, Invested, Unrealized/Realized P/L, Net deposits,
  Total return (measured against net deposits), and *All decisions vs doing nothing*.
- Holdings table: shares, average cost, price, value, weight, sector. The equity chart plots the
  Snapshots value column.

## P6 — X-Ray review (monthly)

- **Sharpe**: risk-adjusted return; >1 good, >2 excellent — meaningful only with months of snapshots.
- **Beta**: ≈1 moves with the benchmark, <1 defensive, >1 amplified.
- **Alpha**: return above what your Beta alone would earn (CAPM). **R²**: how much of your movement
  the benchmark explains.
- **Max drawdown**: worst peak-to-trough of the time-weighted index.
- **Concentration**: effective holdings (1/Herfindahl) and largest-position weight.
- **Sectors**: complete once every ticker has a sector on **Prices**.

## P7 — Review a decision

- When a decision comes due, fill **Review grade** (A–F) and notes on its Decisions row.
  Grade the reasoning, not just the outcome.

## P8 — Reconcile with the app

1. In the app: **Settings → Load demo data**. The workbook ships with the same dataset.
2. Open the **Reconciliation** sheet: each row compares an app figure to the workbook formula.
   Every *Status* must read **PASS**.
3. Running both with real data: after each app action, mirror it here
   (decision → Decisions + Trades; deposit → CashEvents; price refresh → Prices + one Snapshots row),
   then spot-check Portfolio value, Free funds and Total return.

## P9 — Add a new ticker (3 places)

1. **Prices**: add a row (ticker, price, sector, type).
2. **Snapshots**: type the ticker into an empty **yellow** slot header (F3–K3).
3. **Dashboard**: type the ticker into an empty Holdings row (A20–A24).

## P10 — Limitations vs the app

- Only the equity chart is included (no slopegraph / ghost-chart graphics).
- Buying again **after** a partial sell approximates average cost at later sales
  (the app computes the sequential weighted average). All-buys-then-sells is exact.
- Snapshots must be contiguous and dated ascending; one decision per date.
- Full list with rationale: **Reconciliation** sheet → *Assumptions & known differences*.
