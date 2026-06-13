/**
 * Categorical chart palette — a cyan → blue → violet → teal sweep that reads
 * well on both light and dark themes (inspired by modern portfolio dashboards).
 */
export const CHART_COLORS = [
  '#22d3ee', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#a855f7', // purple
  '#0ea5e9', // sky
  '#2dd4bf', // teal-light
  '#7c3aed', // violet-deep
  '#38bdf8', // light blue
];

export const colorForIndex = (i: number): string => CHART_COLORS[i % CHART_COLORS.length];

/** Stable ticker→color map from an ordered ticker list (e.g. by value desc). */
export function buildColorMap(tickers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  tickers.forEach((t, i) => {
    map[t.toUpperCase()] = colorForIndex(i);
  });
  return map;
}
