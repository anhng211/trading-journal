# Trading & Investment Journal

A decision-centric trading journal. Most journals log trades; this one logs **decisions** — a written thesis plus the trades that execute it — and makes the comparison visible:

- **Decision diff** — a "git diff for your portfolio": new positions, exits, and resizes with before/after allocation weights, plus a slopegraph.
- **Ghost portfolio** — every decision freezes the pre-decision portfolio; a chart shows "what you did" vs. "if you'd done nothing" so each decision gets a dollar value.
- **A-vs-B compare** — pick any two decisions and diff the portfolio between them.
- **Review loop** — record expectations and confidence at decision time, grade the decision later, and watch your confidence calibration.

## Stack

React 19 + Vite + TypeScript, Zustand, Recharts. Local-first: all data lives in your browser's localStorage (JSON export/import for backup). Live quotes via a free [Finnhub](https://finnhub.io) API key (optional — every price can be entered manually).

## Develop

```sh
npm install
npm run dev    # dev server
npm test       # unit tests (portfolio math)
npm run build  # type-check + production build
```

## Deploy

Pushes to `main` build and publish to GitHub Pages via `.github/workflows/deploy.yml`.

## Phase 2 (planned)

Social layer: accounts, cloud-synced journals, and shared decision pages. All persistence already goes through a `StorageAdapter` interface (`src/store/storage.ts`) so a Supabase adapter can replace localStorage without touching the UI.
