// Thin API client.
//
// BASE controls where the browser sends requests:
//   • NEXT_PUBLIC_BACKEND_URL set  → the browser calls the NestJS backend
//     directly at that origin. Recommended, because the screener stream is read
//     via fetch()+ReadableStream and the Next.js rewrite proxy can BUFFER
//     streaming responses (which makes progress/partial events all arrive at
//     the very end). The backend's CORS FRONTEND_ORIGIN must include this
//     app's origin.
//   • unset → calls stay relative ("/api/...") through the Next.js rewrite.
// Either way the browser never talks to Alpha Vantage directly.
//
// IMPORTANT: must be NEXT_PUBLIC_ to be readable in browser code. Plain
// BACKEND_URL is a server-only var and is always "" here.
const BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
const url = (path: string) => `${BASE}${path}`;

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

async function jf<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url(path), opts);
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.message)
        msg = Array.isArray(j.message) ? j.message.join(", ") : j.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  status: () =>
    jf<{
      hasKey: boolean;
      universeSize: number;
      running: boolean;
      lastRunAt: string | null;
    }>("/api/screener/status"),

  lastRun: () =>
    jf<{ rows: any[]; meta: RunMeta | null; hadPriorRun: boolean }>(
      "/api/screener/last",
    ),

  compare: (tickers: string[]) =>
    jf<{ rows: any[]; failures: string[] }>(
      `/api/screener/compare?tickers=${encodeURIComponent(tickers.join(","))}`,
    ),

  detail: (ticker: string) =>
    jf<{ payload: any; scored: any }>(
      `/api/screener/detail/${encodeURIComponent(ticker)}`,
    ),

  news: (ticker: string) =>
    jf<any>(`/api/screener/news/${encodeURIComponent(ticker)}`),

  getTheme: () => jf<{ mode: "dark" | "light" }>("/api/theme"),
  setTheme: (mode: "dark" | "light") =>
    jf<{ mode: "dark" | "light" }>("/api/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    }),
};

/**
 * Run the screener with live progress. Reads the backend's Server-Sent-Events
 * stream via fetch() + a ReadableStream reader (NOT EventSource), so it works
 * reliably direct or through the proxy, and honors NEXT_PUBLIC_BACKEND_URL.
 *
 * `onProgress` → {done,total,label} for the progress bar.
 * `onPartial`  → a re-ranked snapshot of everything scored so far (same shape
 *                as onDone) so the table fills in continuously.
 *
 * Returns a cancel function that aborts the in-flight request.
 */
export function runScreenerStream(handlers: {
  onProgress?: (done: number, total: number, label: string) => void;
  onPartial?: (result: {
    rows: any[];
    meta: RunMeta;
    hadPriorRun: boolean;
  }) => void;
  onDone?: (result: {
    rows: any[];
    meta: RunMeta;
    hadPriorRun: boolean;
  }) => void;
  onError?: (message: string) => void;
}): () => void {
  const ctrl = new AbortController();

  const dispatch = (event: string, data: string) => {
    if (!data) return;
    let payload: any;
    try {
      payload = JSON.parse(data);
    } catch {
      return; // ignore heartbeats / non-JSON
    }
    if (event === "progress") {
      handlers.onProgress?.(payload.done, payload.total, payload.label);
    } else if (event === "partial") {
      handlers.onPartial?.(payload);
    } else if (event === "done") {
      handlers.onDone?.(payload);
    } else if (event === "error") {
      handlers.onError?.(payload.message || "Screener run failed.");
    }
  };

  // Parse ONE complete SSE event block ("event:"/"data:" lines).
  const flush = (block: string) => {
    const lines = block.split(/\r?\n/);
    let event = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (!line || line.startsWith(":")) continue; // blank / comment (heartbeat)
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length) dispatch(event, dataLines.join("\n"));
  };

  (async () => {
    try {
      const res = await fetch(url("/api/screener/run-stream"), {
        method: "GET",
        headers: { Accept: "text/event-stream" },
        signal: ctrl.signal,
        cache: "no-store",
      });

      if (!res.ok || !res.body) {
        handlers.onError?.(`Stream failed to start (${res.status}).`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Normalize CRLF so we can split on a single delimiter.
        buffer = buffer.replace(/\r\n/g, "\n");

        // Events are separated by a blank line ("\n\n"). Drain every complete
        // block currently in the buffer; keep the remainder for the next chunk.
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          flush(block);
        }
      }
      // flush any trailing block without a final blank line
      if (buffer.trim()) flush(buffer);
    } catch (err) {
      if ((err as any)?.name !== "AbortError") {
        handlers.onError?.((err as Error).message || "Screener stream error.");
      }
    }
  })();

  return () => ctrl.abort();
}

/**
 * AI Service
 */
// AI chat service — posts a prompt to the n8n webhook and returns the text reply.
// Ported to TypeScript with the same retry/session behavior as the original.

const getBaseUrl = (): string =>
  "https://n8n.srv1375926.hstgr.cloud/webhook/62430e45-1007-4638-9c42-9bdffe84886b";

const API_BASE_URL = getBaseUrl();

// Stable per-tab session id (regenerated when a fresh tab/window opens).
const getSessionId = (): string => {
  const KEY = "jarvis_session_id";
  if (typeof window === "undefined") return "server";
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(KEY, id);
  }
  return id;
};

const FALLBACK_MESSAGE = "No response received from the server.";
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Send a user message to the chat API and return the bot's text response. */
export async function sendChatMessage(message: string): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(API_BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId: getSessionId() }),
      });

      if (!response.ok)
        throw new Error(`Server responded with status: ${response.status}`);

      const text = await response.text();
      if (!text || !text.trim()) throw new Error("Empty response body");

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Invalid JSON in response");
      }

      if (data.output) return data.output as string;
      throw new Error("Missing output field in response");
    } catch (error) {
      lastError = error;
      // eslint-disable-next-line no-console
      console.warn(
        `AI attempt ${attempt}/${MAX_ATTEMPTS} failed:`,
        (error as Error).message,
      );
      if (attempt < MAX_ATTEMPTS) await delay(RETRY_DELAY_MS);
    }
  }

  // eslint-disable-next-line no-console
  console.error("All AI attempts exhausted:", lastError);
  return FALLBACK_MESSAGE;
}
