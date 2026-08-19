export type PageId =
  | 'dashboard'
  | 'results'
  | 'history'
  | 'breakdown'
  | 'analytics'
  | 'compare'
  | 'sources'
  | 'settings'
  | 'admin'
  | 'detail';

// [id, sidebar label, page title, page subtitle]
export const NAV: [PageId, string, string, string][] = [
  ['dashboard', 'Dashboard', 'Weekly Momentum Screener Dashboard', 'Overview of the latest weekly screener run'],
  ['results', 'Weekly Results', 'Weekly Results (Screener Output)', 'Ranked output from the latest run'],
  ['history', 'Run History', 'Screener Run History', 'Every completed weekly run'],
  ['breakdown', 'Breakdown Watch', 'Breakdown Watch', 'Stocks with deteriorating momentum'],
  ['analytics', 'Analytics', 'Analytics', 'Distribution and sector analysis'],
  ['compare', 'Compare Stocks', 'Compare Stocks', 'Side-by-side factor comparison'],
  ['sources', 'Data Sources', 'Data Source Status', 'Health of every upstream feed'],
  ['settings', 'Settings', 'Settings', 'Screener thresholds and preferences'],
  ['admin', 'Admin', 'Admin Run Monitor', 'Trigger and monitor screener runs'],
];

export const ICONS: Record<string, string> = {
  dashboard: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>',
  results: '<path d="M3 6h18M3 12h18M3 18h12"/>',
  history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  breakdown: '<path d="M3 17l6-6 4 4 8-8"/><path d="M21 15V7h-8"/>',
  analytics: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  compare: '<path d="M8 3v18M16 3v18M3 8h18M3 16h18"/>',
  sources:
    '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1A1.6 1.6 0 007 19.4a1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003 15a2 2 0 010-4 1.6 1.6 0 001.1-2.7l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 009 4.6 2 2 0 0111 3a2 2 0 014 0 1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1A1.6 1.6 0 0021 11a2 2 0 010 4z"/>',
  admin: '<path d="M12 2l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/>',
};
