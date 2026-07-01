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

export interface ProfileResult {
  ticker: string;
  sector: string | null;
}

/** Company profile (free tier): we only use finnhubIndustry as the sector label. */
export async function fetchProfile(ticker: string, apiKey: string): Promise<ProfileResult> {
  const symbol = ticker.toUpperCase();
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
    );
    if (!res.ok) return { ticker: symbol, sector: null };
    const data = (await res.json()) as { finnhubIndustry?: string };
    return { ticker: symbol, sector: data.finnhubIndustry?.trim() || null };
  } catch {
    return { ticker: symbol, sector: null };
  }
}

export async function fetchProfiles(tickers: string[], apiKey: string): Promise<ProfileResult[]> {
  return Promise.all(tickers.map((t) => fetchProfile(t, apiKey)));
}
