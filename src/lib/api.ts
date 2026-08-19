// Thin API client. All calls hit the Next.js /api proxy, which forwards to NestJS.
// The browser never talks to Alpha Vantage directly.

export interface RunMeta {
  universeN: number;
  qualifiedN: number;
  avgComposite: number;
  spy: any;
  failures: number;
  gateBypassed: boolean;
  noEstimates: boolean;
  fetched: number;
  ranAt: string;
}

async function jf<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.message) msg = Array.isArray(j.message) ? j.message.join(', ') : j.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  status: () =>
    jf<{ hasKey: boolean; universeSize: number; running: boolean; lastRunAt: string | null }>(
      '/api/screener/status',
    ),

  lastRun: () => jf<{ rows: any[]; meta: RunMeta | null; hadPriorRun: boolean }>('/api/screener/last'),

  compare: (tickers: string[]) =>
    jf<{ rows: any[]; failures: string[] }>(
      `/api/screener/compare?tickers=${encodeURIComponent(tickers.join(','))}`,
    ),

  detail: (ticker: string) =>
    jf<{ payload: any; scored: any }>(`/api/screener/detail/${encodeURIComponent(ticker)}`),

  news: (ticker: string) => jf<any>(`/api/screener/news/${encodeURIComponent(ticker)}`),

  getTheme: () => jf<{ mode: 'dark' | 'light' }>('/api/theme'),
  setTheme: (mode: 'dark' | 'light') =>
    jf<{ mode: 'dark' | 'light' }>('/api/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    }),
};

/**
 * Run the screener with live progress via SSE. Falls back to a blocking POST if
 * EventSource isn't available. Returns the final result via onDone.
 */
export function runScreenerStream(handlers: {
  onProgress?: (done: number, total: number, label: string) => void;
  onDone?: (result: { rows: any[]; meta: RunMeta; hadPriorRun: boolean }) => void;
  onError?: (message: string) => void;
}): () => void {
  const es = new EventSource('/api/screener/run-stream');
  es.addEventListener('progress', (e: MessageEvent) => {
    try {
      const d = JSON.parse(e.data);
      handlers.onProgress?.(d.done, d.total, d.label);
    } catch {
      /* ignore */
    }
  });
  es.addEventListener('done', (e: MessageEvent) => {
    try {
      handlers.onDone?.(JSON.parse(e.data));
    } catch (err) {
      handlers.onError?.((err as Error).message);
    }
    es.close();
  });
  es.addEventListener('error', (e: MessageEvent) => {
    // EventSource fires a generic error on close; only surface if we have a message.
    let msg = '';
    try {
      msg = JSON.parse((e as MessageEvent).data)?.message || '';
    } catch {
      /* connection error */
    }
    if (msg) {
      handlers.onError?.(msg);
      es.close();
    }
  });
  return () => es.close();
}
