/** Finnhub quote client. Free tier: 60 calls/min, US stocks/ETFs. */

export interface QuoteResult {
  ticker: string;
  price: number | null;
  error?: string;
}

export async function fetchQuote(ticker: string, apiKey: string): Promise<QuoteResult> {
  const symbol = ticker.toUpperCase();
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
    );
    if (!res.ok) return { ticker: symbol, price: null, error: `HTTP ${res.status}` };
    const data = (await res.json()) as { c?: number };
    if (!data.c || data.c <= 0) return { ticker: symbol, price: null, error: 'no quote' };
    return { ticker: symbol, price: data.c };
  } catch (e) {
    return { ticker: symbol, price: null, error: e instanceof Error ? e.message : 'fetch failed' };
  }
}

export async function fetchQuotes(tickers: string[], apiKey: string): Promise<QuoteResult[]> {
  return Promise.all(tickers.map((t) => fetchQuote(t, apiKey)));
}
