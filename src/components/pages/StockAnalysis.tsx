"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useLayoutEffect,
  useCallback,
} from "react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const TICKERS_API = "/api/proxy?api=getTickers&page=0&size=13000";
const SCORE_WEBHOOK_URL =
  "https://n8n.srv1375926.hstgr.cloud/webhook/jarvis-score-stock";
const REQUEST_TIMEOUT_MS = 6 * 60 * 1000;

// Cache: remembers every ticker already analysed (memory + localStorage) so a
// repeat search opens instantly. The server itself reuses scores for 7 days.
const CACHE_KEY = "jarvis_score_cache_v1";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 30;

const TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;
const COMMON = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "NFLX"];

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface TickerRecord {
  idStock: number;
  stockName: string;
  company: string;
}

// ─── CACHE ───────────────────────────────────────────────────────────────────
type CacheEntry = { data: any; savedAt: number };
const MEM_CACHE = new Map<string, CacheEntry>();

function readStore(): Record<string, CacheEntry> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function getCached(ticker: string): CacheEntry | null {
  const fresh = (e?: CacheEntry | null) =>
    e && Date.now() - e.savedAt < CACHE_TTL_MS ? e : null;
  const mem = fresh(MEM_CACHE.get(ticker));
  if (mem) return mem;
  if (typeof window === "undefined") return null;
  const stored = fresh(readStore()[ticker]);
  if (stored) MEM_CACHE.set(ticker, stored);
  return stored;
}

function setCached(ticker: string, data: any) {
  // raw_inputs is large and never shown, so it is not stored
  const { raw_inputs, ...slim } = data || {};
  const entry: CacheEntry = { data: slim, savedAt: Date.now() };
  MEM_CACHE.set(ticker, entry);
  try {
    const store = readStore();
    store[ticker] = entry;
    const keys = Object.keys(store);
    if (keys.length > CACHE_MAX_ENTRIES) {
      keys
        .sort((a, b) => store[a].savedAt - store[b].savedAt)
        .slice(0, keys.length - CACHE_MAX_ENTRIES)
        .forEach((k) => delete store[k]);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {
    /* storage full / blocked: memory cache still works */
  }
}

// ─── FORMATTERS ──────────────────────────────────────────────────────────────
const isNum = (v: any) => v !== null && v !== undefined && isFinite(v);
const fmtMoney = (v: any, dp = 0) =>
  !isNum(v)
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: dp,
        minimumFractionDigits: dp,
      }).format(v);
const fmtBig = (v: any) => {
  if (!isNum(v)) return "—";
  const a = Math.abs(v);
  return a >= 1e12
    ? "$" + (v / 1e12).toFixed(2) + "T"
    : a >= 1e9
    ? "$" + (v / 1e9).toFixed(1) + "B"
    : a >= 1e6
    ? "$" + (v / 1e6).toFixed(1) + "M"
    : fmtMoney(v);
};
const fmtNum = (v: any, dp = 1) => (!isNum(v) ? "—" : (+v).toFixed(dp));
const fmtDate = (s: any) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime())
    ? String(s)
    : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};
const sentence = (s: any) =>
  s ? String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase() : "";
const scoreColor = (s: any) =>
  !isNum(s) ? "#8a9490" : s >= 70 ? "#2F8F55" : s >= 50 ? "#B98419" : "#B4493B";
const confColor = (c: string) =>
  c === "High" ? "#2F8F55" : c === "Medium" ? "#B98419" : "#B4493B";
const trendText = (t: string) =>
  ({ Improving: "Improving", Deteriorating: "Weakening", Stable: "Stable", New: "First score" } as any)[t] || "";

// ─── SVG ICONS (UI) ──────────────────────────────────────────────────────────
type IconType = "sparkle" | "arrow" | "close" | "chevron" | "print";
const Icon = ({ type }: { type: IconType }) => {
  const paths: Record<IconType, React.ReactNode> = {
    sparkle: (
      <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    ),
    arrow: <path d="M14 5l7 7m0 0l-7 7m7-7H3" />,
    close: (
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    ),
    chevron: <polyline points="6 9 12 15 18 9" />,
    print: (
      <>
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      {paths[type]}
    </svg>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// PIPELINE ANIMATION (exact port of the reference HTML)
// ═════════════════════════════════════════════════════════════════════════════
const reduceMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const STAGES: any[] = [
  { nodes: [{ id: "cache", label: "Check saved scores", icon: "db", ms: 1200, msgs: ["Looking for a score from the last 7 days"] }] },
  {
    compact: true,
    nodes: [
      { id: "profile", label: "Company profile", icon: "building", ms: 2200, msgs: ["Sector, size and analyst targets"] },
      { id: "prices", label: "Price history", icon: "chart", ms: 3400, msgs: ["Two years of weekly prices vs the S&P 500"] },
      { id: "financials", label: "Financial statements", icon: "ledger", ms: 4600, msgs: ["16 quarters of income, cash flow and balance sheet"] },
      { id: "estimates", label: "Earnings & estimates", icon: "target", ms: 3800, msgs: ["Consensus EPS today and 7, 30, 60, 90 days ago"] },
      { id: "call", label: "Earnings call", icon: "mic", ms: 5200, msgs: ["Latest earnings call transcript"] },
      { id: "news", label: "News", icon: "news", ms: 3000, msgs: ["Recent headlines and sentiment"] },
    ],
  },
  { nodes: [{ id: "quant", label: "Calculate factors", icon: "scale", ms: 3000, msgs: ["Revenue and profit acceleration", "Estimate revisions and reversals", "Valuation against its own history", "Momentum and volatility"] }] },
  { nodes: [{ id: "ai", label: "AI analyst review", icon: "spark", ai: true, ms: 14000, msgs: ["Reading the earnings call", "Judging catalysts and competitive position", "Weighing what the thesis depends on", "Separating evidence from counter-evidence"] }] },
  { nodes: [{ id: "engines", label: "Four engines", icon: "engine", ms: 1400, msgs: ["Growth 30%, Quality 25%, Momentum 25%, Valuation 20%"] }] },
  { nodes: [{ id: "take", label: "Write Jarvis Take", icon: "pen", ai: true, hold: true, ms: 3000, msgs: ["Summarising what drives the score"], waitMsgs: ["Checking the numbers it cites", "Adding the main counter-evidence", "Almost there"] }] },
  { nodes: [{ id: "save", label: "Save snapshot", icon: "save", ms: 700, msgs: ["Stored for comparison next time"] }] },
  { nodes: [{ id: "done", label: "Score ready", icon: "flag", final: true }] },
];

const ICON_PATHS: Record<string, string> = {
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  scale: '<path d="M12 4v16M6 20h12"/><path d="M5 8h14"/><path d="M5 8l-3 6h6zM19 8l-3 6h6z"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16l4-5 3 3 5-7"/>',
  pen: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  db: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  building: '<path d="M4 21V5l8-2v18M12 7l8 2v12"/><path d="M8 9v.01M8 13v.01M8 17v.01M16 13v.01M16 17v.01"/>',
  ledger: '<path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12h.01"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  news: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M8 9h5M8 13h5M8 16h3"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4"/><rect x="8" y="13" width="8" height="5"/>',
  engine: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
};

const BADGES = {
  active: '<svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="8" fill="none" style="stroke:rgba(var(--sig-rgb),.25)" stroke-width="2.5"/><path class="sa-spin" d="M11 3a8 8 0 0 1 8 8" fill="none" style="stroke:var(--signal)" stroke-width="2.5" stroke-linecap="round"/></svg>',
  done: '<svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="9" style="fill:var(--signal)"/><path d="M6.5 11.2l3 3 6-6.4" fill="none" style="stroke:var(--panel)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  final: '<svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="9" style="fill:var(--brass)"/><path d="M6.5 11.2l3 3 6-6.4" fill="none" style="stroke:var(--panel)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  err: '<svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="9" fill="#B4493B"/><path d="M8 8l6 6M14 8l-6 6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CANCELLED = { cancelled: true };

/* Plays the stages while the real request is in flight. Nodes with hold:true
   wait for the response; if the response arrives early the rest speeds up. */
async function runPipeline({ stages, setNode, log, request, isCancelled, onEarlyResponse }: any) {
  let settled = false;
  let result: any;
  let error: any;
  let told = false;
  const p = request()
    .then((r: any) => { result = r; }, (e: any) => { error = e; })
    .finally(() => { settled = true; });
  const chk = () => { if (isCancelled()) throw CANCELLED; };
  const sl = async (ms: number) => { await sleep(ms); chk(); };
  const nap = async (ms: number) => {
    const end = Date.now() + ms;
    while (!settled && Date.now() < end) await sl(Math.min(200, end - Date.now()));
    if (settled) await sl(110);
  };
  let current: any[] = [];
  try {
    for (const stage of stages) {
      chk();
      current = stage.nodes;
      stage.nodes.forEach((n: any) => setNode(n.id, "active"));
      if (stage.nodes.some((n: any) => n.final)) {
        if (!settled) await p;
        chk();
        break;
      }
      const hold = stage.nodes.some((n: any) => n.hold);
      const runs = stage.nodes.map(async (n: any, idx: number) => {
        const msgs: string[] = n.msgs || [];
        const dur = n.ms || stage.ms || 2000;
        const gap = Math.max(500, dur / Math.max(1, msgs.length));
        await sl(settled ? 0 : idx * 220);
        for (let i = 0; i < msgs.length; i++) {
          if (settled && i > 0) break;
          log(n.label, msgs[i]);
          await nap(gap);
          if (error) throw error;
        }
        if (hold && !settled) {
          const waits: string[] = n.waitMsgs || [];
          let k = 0;
          while (!settled) {
            await nap(4200);
            if (!settled && waits.length) log(n.label, waits[k++ % waits.length]);
          }
        }
        if (error) throw error;
        await sl(settled ? 90 : 0);
        setNode(n.id, "done");
      });
      await Promise.all(runs);
      if (error) throw error;
      if (settled && onEarlyResponse && !told) {
        told = true;
        onEarlyResponse(result, log);
      }
    }
    await p;
    chk();
    if (error) throw error;
    const last = stages[stages.length - 1].nodes;
    last.forEach((n: any) => setNode(n.id, "done"));
    log(last[0].label, "Complete", "ok");
    return result;
  } catch (e) {
    if (e === CANCELLED) throw e;
    current.forEach((n) => setNode(n.id, "err"));
    log((current[0] || {}).label || "Pipeline", (e as any).message || "Something went wrong", "bad");
    throw e;
  }
}

async function callWebhook(url: string, options: RequestInit, timeoutMs: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = null; }
    if (!res.ok) {
      const msg = (data && (data.message || data.error)) || text || `HTTP ${res.status}`;
      throw new Error(typeof msg === "string" ? msg.slice(0, 300) : `Request failed (HTTP ${res.status})`);
    }
    if (!data) throw new Error("The analysis service returned an empty response.");
    return Array.isArray(data) ? data[0] : data;
  } catch (e: any) {
    if (e.name === "AbortError") throw new Error("This is taking longer than expected. Please try again in a few minutes.");
    if (e instanceof TypeError) throw new Error("Could not reach the analysis service. Check your connection and try again.");
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// n8n-style node graph (same layout maths as the reference, incl. compact stages)
function layoutGraph(stages: any[], W: number) {
  const horizontal = W >= 760;
  const NODE = 58, LABEL_W = 120, ROW = 98;
  const pos: Record<string, any> = {};
  if (horizontal) {
    const CROW = 52, CW = 168, CBOX = 38;
    const units = stages.reduce((a, s) => a + (s.compact ? 1.45 : 1), 0);
    const colW = W / units;
    const stageH = (s: any) => (s.compact ? s.nodes.length * CROW : s.nodes.length * ROW);
    const H = Math.max(...stages.map(stageH)) + 28;
    let unit = 0;
    stages.forEach((s) => {
      const u = s.compact ? 1.45 : 1;
      const cx = (unit + u / 2) * colW;
      const top0 = (H - stageH(s)) / 2 + 14;
      s.nodes.forEach((n: any, i: number) => {
        if (s.compact) {
          const x = cx - CW / 2, y = top0 + i * CROW;
          pos[n.id] = { x, y, compact: true, inX: x, inY: y + CBOX / 2, outX: x + CW, outY: y + CBOX / 2 };
        } else {
          const top = top0 + i * ROW;
          pos[n.id] = { x: cx - LABEL_W / 2, y: top, inX: cx - NODE / 2, inY: top + NODE / 2, outX: cx + NODE / 2, outY: top + NODE / 2 };
        }
      });
      unit += u;
    });
    return { pos, H, horizontal };
  }
  const per = Math.max(2, Math.min(3, Math.floor(W / 120)));
  let y = 10;
  stages.forEach((s) => {
    const rows = Math.ceil(s.nodes.length / per);
    s.nodes.forEach((n: any, i: number) => {
      const inRow = Math.min(per, s.nodes.length - Math.floor(i / per) * per);
      const c = i % per, r = Math.floor(i / per);
      const cx = W / 2 + (c - (inRow - 1) / 2) * (W / per);
      const top = y + r * (ROW + 6);
      pos[n.id] = { x: cx - LABEL_W / 2, y: top, inX: cx, inY: top, outX: cx, outY: top + NODE + 36 };
    });
    y += rows * (ROW + 6) + 22;
  });
  return { pos, H: y, horizontal };
}

function PipelineCanvas({ stages, state }: { stages: any[]; state: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(1000);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setW(el.clientWidth || 1000);
    measure();
    let t: any;
    const onResize = () => { clearTimeout(t); t = setTimeout(measure, 120); };
    window.addEventListener("resize", onResize);
    return () => { clearTimeout(t); window.removeEventListener("resize", onResize); };
  }, []);

  const { pos, H, horizontal } = useMemo(() => layoutGraph(stages, W), [stages, W]);

  const wires: { key: string; to: string; d: string }[] = [];
  for (let i = 1; i < stages.length; i++) {
    for (const a of stages[i - 1].nodes) {
      for (const b of stages[i].nodes) {
        const p = pos[a.id], q = pos[b.id];
        let d: string;
        if (horizontal) {
          const dx = (q.inX - p.outX) / 2;
          d = `M${p.outX},${p.outY} C${p.outX + dx},${p.outY} ${q.inX - dx},${q.inY} ${q.inX},${q.inY}`;
        } else {
          const dy = (q.inY - p.outY) / 2;
          d = `M${p.outX},${p.outY} C${p.outX},${p.outY + dy} ${q.inX},${q.inY - dy} ${q.inX},${q.inY}`;
        }
        wires.push({ key: `${a.id}-${b.id}`, to: b.id, d });
      }
    }
  }
  const motion = !reduceMotion();

  return (
    <div className="sa-graph" ref={ref} style={{ height: H }}>
      <svg className="sa-wires" width={W} height={H} aria-hidden="true">
        {wires.map((w) => {
          const st = state[w.to] || "idle";
          const cls = st === "active" ? "flow" : st === "done" ? "done" : st === "err" ? "err" : "";
          return (
            <g key={w.key}>
              <path d={w.d} className={`sa-wire ${cls}`} />
              {st === "active" && motion && (
                <circle r="4" className="sa-pulse-dot">
                  <animateMotion dur="1.4s" repeatCount="indefinite" path={w.d} />
                </circle>
              )}
            </g>
          );
        })}
      </svg>
      {stages.flatMap((s) => s.nodes).map((n: any) => {
        const p = pos[n.id];
        const st = state[n.id] || "idle";
        const badge = st === "active" ? BADGES.active : st === "done" ? (n.final ? BADGES.final : BADGES.done) : st === "err" ? BADGES.err : "";
        return (
          <div
            key={n.id}
            className={`sa-node ${st !== "idle" ? st : ""} ${n.final ? "final" : ""} ${p.compact && horizontal ? "compact" : ""}`}
            style={{ left: p.x, top: p.y }}
            aria-label={`${n.label}: ${st === "active" ? "working" : st === "done" ? "done" : st === "err" ? "failed" : "waiting"}`}
          >
            <div className="sa-box">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: ICON_PATHS[n.icon] || "" }}
              />
              <span className="sa-badge" dangerouslySetInnerHTML={{ __html: badge }} />
            </div>
            <div className="sa-label">{n.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── GENERATING VIEW (animation panel) ───────────────────────────────────────
function GeneratingView({
  ticker,
  nodeState,
  logs,
  error,
  startedAt,
  onCancel,
  onRetry,
}: {
  ticker: string;
  nodeState: Record<string, string>;
  logs: { t: string; label: string; text: string; cls: string }[];
  error: string;
  startedAt: number;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (error) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [error]);
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const clock = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <div className="sa-wrap">
      <div className="sa-run-panel">
        <div className="sa-run-head">
          <div>
            <h2>Analysing {ticker}</h2>
            <p>Jarvis is gathering data and scoring twelve factors</p>
          </div>
          <div className="sa-run-meta">
            <span className="sa-clock">
              Elapsed <b>{clock}</b>
            </span>
            <button type="button" className="sa-ghost" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
        <PipelineCanvas stages={STAGES} state={nodeState} />
        <div className="sa-log" aria-live="polite">
          <ol>
            {logs.map((l, i) => (
              <li key={`${i}-${l.t}-${l.text}`} className={l.cls}>
                <time>{l.t}</time>
                <strong>{l.label}</strong>
                <span>{l.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      {error && (
        <div className="sa-error-box" role="alert">
          <p>{error}</p>
          <div className="sa-error-actions">
            <button type="button" className="sa-btn-quiet" onClick={onCancel}>
              Back
            </button>
            <button type="button" className="sa-btn-main" onClick={onRetry}>
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RESULTS VIEW ────────────────────────────────────────────────────────────
const ENGINE_LABEL: Record<string, string> = {
  growth: "Growth",
  quality: "Quality",
  momentum: "Momentum",
  valuation: "Valuation",
};
const ENGINE_WEIGHT: Record<string, number> = { growth: 0.3, quality: 0.25, momentum: 0.25, valuation: 0.2 };

function ScoreRing({ total, parts }: { total: any; parts: any[] }) {
  const R = 74, C = 2 * Math.PI * R, GAP = 4;
  const wSum = parts.reduce((a, p) => a + p.weight, 0);
  let off = 0;
  const segs: React.ReactNode[] = [];
  parts.forEach((p) => {
    const len = (C * p.weight) / wSum - GAP;
    const missing = !isNum(p.score);
    const fill = missing ? 0 : (len * Math.max(0, Math.min(100, p.score))) / 100;
    segs.push(
      <circle key={p.key + "-bg"} cx="86" cy="86" r={R} fill="none" stroke={missing ? "url(#sa-hatch)" : "rgba(138,148,144,.25)"} strokeWidth="13" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off}>
        <title>{`${p.label}: ${missing ? "not available" : Math.round(p.score)}`}</title>
      </circle>
    );
    if (fill > 0) {
      segs.push(
        <circle key={p.key + "-fg"} cx="86" cy="86" r={R} fill="none" stroke={scoreColor(p.score)} strokeWidth="13" strokeDasharray={`${fill} ${C - fill}`} strokeDashoffset={-off} />
      );
    }
    off += len + GAP;
  });
  return (
    <div className="sa-ring" role="img" aria-label={`Jarvis Score ${isNum(total) ? Math.round(total) : "not available"} out of 100`}>
      <svg viewBox="0 0 172 172">
        <defs>
          <pattern id="sa-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="rgba(138,148,144,.10)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(138,148,144,.45)" strokeWidth="2" />
          </pattern>
        </defs>
        {segs}
      </svg>
      <div className="sa-ring-centre">
        <div className="sa-ring-num" style={{ color: scoreColor(total) }}>
          {isNum(total) ? Math.round(total) : "—"}
        </div>
        <div className="sa-ring-of">out of 100</div>
      </div>
    </div>
  );
}

const stripKey = (x: string) => String(x).replace(/^[a-z_0-9]+:\s*/, "");

function FactorDetail({ f }: { f: any }) {
  const ev = (f.evidence || []).slice(0, 3);
  const cev = (f.counter_evidence || []).slice(0, 2);
  const miss = (f.missing_inputs || []).slice(0, 3);
  return (
    <>
      <p>
        <span className="sa-pill">{f.confidence} confidence</span>{" "}
        {f.trend && f.trend !== "New" && (
          <span className="sa-pill">
            {trendText(f.trend)}
            {f.score_change ? ` (${f.score_change > 0 ? "+" : ""}${f.score_change})` : ""}
          </span>
        )}{" "}
        {f.status === "PARTIAL" && <span className="sa-pill">Some inputs missing</span>}
      </p>
      {ev.length > 0 && (
        <div>
          <p className="sa-lbl">Supporting evidence</p>
          <ul className="sa-ev">{ev.map((x: string, i: number) => <li key={i}>{stripKey(x)}</li>)}</ul>
        </div>
      )}
      {cev.length > 0 && (
        <div>
          <p className="sa-lbl">Counter-evidence</p>
          <ul className="sa-ev">{cev.map((x: string, i: number) => <li key={i}>{stripKey(x)}</li>)}</ul>
        </div>
      )}
      {miss.length > 0 && (
        <div>
          <p className="sa-lbl">Not available</p>
          <ul className="sa-ev sa-muted">{miss.map((x: string, i: number) => <li key={i}>{stripKey(x)}</li>)}</ul>
        </div>
      )}
    </>
  );
}

function ReportView({
  data,
  fromSaved,
  onAgain,
}: {
  data: any;
  fromSaved: boolean;
  onAgain: () => void;
}) {
  const P = data.profile || {};
  const risk = data.position_risk || {};
  const [tab, setTab] = useState("take");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const parts = Object.keys(ENGINE_WEIGHT).map((k) => ({
    key: k,
    label: ENGINE_LABEL[k],
    weight: ENGINE_WEIGHT[k],
    score: data.engines?.[k]?.score ?? null,
  }));
  const factors = Object.values(data.factors || {}).sort((a: any, b: any) =>
    String(a.factor_id).localeCompare(String(b.factor_id))
  ) as any[];
  const riskFactor = factors.find((f) => f.factor_id === "f12");
  const catalysts: string[] = data.key_catalysts || [];
  const risks: string[] = data.main_risks || [];

  const scored = factors.filter((f) => isNum(f.score_0_100));
  const strongest = [...scored].sort((a, b) => b.score_0_100 - a.score_0_100).slice(0, 3);
  const weakest = [...scored].sort((a, b) => a.score_0_100 - b.score_0_100).slice(0, 3);

  const take: string = data.jarvis_take || "";
  const firstEnd = take.search(/[.!?]\s/);
  const lead = firstEnd > 0 ? take.slice(0, firstEnd + 1) : take;
  const rest = firstEnd > 0 ? take.slice(firstEnd + 1).trim() : "";

  const TABS = [
    { id: "take", label: "Jarvis Take" },
    { id: "factors", label: "Twelve factors", count: factors.length },
    { id: "catalysts", label: "Catalysts", count: catalysts.length },
    { id: "risks", label: "Risks", count: risks.length },
    { id: "change", label: "What could change it" },
    { id: "position", label: "Position risk" },
  ];

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next.id);
    document.getElementById(`sa-tab-${next.id}`)?.focus();
  };

  const pane = (id: string, title: string, caption: string, children: React.ReactNode) => (
    <div
      key={id}
      id={`sa-pane-${id}`}
      role="tabpanel"
      aria-labelledby={`sa-tab-${id}`}
      className={`sa-pane ${tab === id ? "" : "closed"}`}
    >
      <header className="sa-pane-head">
        <h2>{title}</h2>
        <p>{caption}</p>
      </header>
      {children}
    </div>
  );

  const items = (list: string[], kind: "good" | "warn", empty: string) =>
    list.length ? (
      <ul className="sa-items">
        {list.map((x, i) => (
          <li key={i} className={`sa-item ${kind}`}>
            <span className="sa-item-n">{String(i + 1).padStart(2, "0")}</span>
            <span>{x}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="sa-muted">{empty}</p>
    );

  const factorList = (list: any[]) => (
    <ul className="sa-mini">
      {list.map((f) => (
        <li key={f.factor_id}>
          <span>{f.display_name}</span>
          <b style={{ color: scoreColor(f.score_0_100) }}>{Math.round(f.score_0_100)}</b>
        </li>
      ))}
    </ul>
  );

  const riskPos = Math.max(0, Math.min(100, Number(risk.score) || 0));

  return (
    <div className="sa-wrap sa-report">
      <div className="sa-res-top">
        <div>
          <div className="sa-chips">
            <span className="sa-ticker">{data.ticker}</span>
            {P.exchange && <span className="sa-chip">{P.exchange}</span>}
            {P.sector && <span className="sa-chip">{sentence(P.sector)}</span>}
          </div>
          <h1>{P.name || data.ticker}</h1>
        </div>
        <div className="sa-acts sa-noprint">
          <button type="button" className="sa-btn-quiet" onClick={onAgain}>
            Analyse another stock
          </button>
          <button type="button" className="sa-btn-main" onClick={() => window.print()}>
            <Icon type="print" /> Print / Save PDF
          </button>
        </div>
      </div>

      <div className="sa-stats">
        <div>
          <span>Share price</span>
          <b>{fmtMoney(P.price, 2)}</b>
          {P.price_date && <small>as of {fmtDate(P.price_date)}</small>}
        </div>
        <div>
          <span>Market value</span>
          <b>{fmtBig(P.market_cap)}</b>
          {P.currency && <small>{P.currency}</small>}
        </div>
        <div>
          <span>Industry</span>
          <b className="sa-stat-text">{P.industry ? sentence(P.industry) : "—"}</b>
          {P.fiscal_year_end && <small>Fiscal year ends {P.fiscal_year_end}</small>}
        </div>
        <div>
          <span>{data.source === "cache" || fromSaved ? "Saved score" : "Scored on"}</span>
          <b>{fmtDate(data.calculated_at)}</b>
          <small>Methodology {data.methodology_version || "1.0"}</small>
        </div>
      </div>

      <div className="sa-grid">
        <section className="sa-panel">
          <div className="sa-tabs sa-noprint" role="tablist" aria-label="Report sections">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                id={`sa-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                aria-controls={`sa-pane-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                className={`sa-tab ${tab === t.id ? "on" : ""}`}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => onTabKey(e, i)}
              >
                {t.label}
                {t.count !== undefined && <span className="sa-tab-count">{t.count}</span>}
              </button>
            ))}
          </div>

          <div className="sa-panel-body">
            {pane(
              "take",
              "Jarvis Take",
              "The short version of what is driving this score.",
              <>
                {lead && <p className="sa-lead">{lead}</p>}
                {rest && <p className="sa-body">{rest}</p>}
                {!take && <p className="sa-muted">Summary not available.</p>}
                {scored.length > 0 && (
                  <div className="sa-sw">
                    <div>
                      <h3>Strongest factors</h3>
                      {factorList(strongest)}
                    </div>
                    <div>
                      <h3>Weakest factors</h3>
                      {factorList(weakest)}
                    </div>
                  </div>
                )}
              </>
            )}

            {pane(
              "factors",
              "Twelve factors",
              "Select a factor to see the evidence behind it. Higher is always better, including for risk.",
              <ul className="sa-factors">
                {factors.map((f) => {
                  const isOpen = !!open[f.factor_id];
                  const isRisk = f.factor_id === "f12";
                  return (
                    <li key={f.factor_id}>
                      <button
                        type="button"
                        className="sa-factor-btn"
                        aria-expanded={isOpen}
                        onClick={() => setOpen((o) => ({ ...o, [f.factor_id]: !o[f.factor_id] }))}
                      >
                        <span className="sa-fid">{String(f.factor_id).toUpperCase()}</span>
                        <span className="sa-nm">
                          {f.display_name}
                          {f.display_name !== f.factor_name && <small>{f.factor_name}</small>}
                          {isRisk && risk.label && <small>{risk.label}</small>}
                        </span>
                        <span className="sa-meter" aria-hidden="true">
                          <i style={{ width: `${f.score_0_100 || 0}%`, background: scoreColor(f.score_0_100) }} />
                        </span>
                        <span className="sa-sc" style={{ color: scoreColor(f.score_0_100), borderColor: scoreColor(f.score_0_100) }}>
                          {isNum(f.score_0_100) ? Math.round(f.score_0_100) : "—"}
                        </span>
                        <span className="sa-chev sa-noprint">
                          <Icon type="chevron" />
                        </span>
                      </button>
                      <div className={`sa-factor-detail ${isOpen ? "" : "closed"}`}>
                        <FactorDetail f={f} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {pane(
              "catalysts",
              "Catalysts",
              "Developments that could push the business and the score higher.",
              items(catalysts, "good", "No catalysts identified.")
            )}

            {pane(
              "risks",
              "Risks",
              "What could go wrong, based on the evidence reviewed.",
              items(risks, "warn", "No risks identified.")
            )}

            {pane(
              "change",
              "What would change the score",
              "The evidence that would move the Jarvis Score up or down.",
              <>
                <p className="sa-body sa-body-first">{data.what_would_change_score || "—"}</p>
                {data.what_changed && (
                  <div className="sa-note-block">
                    <h3>Since the last score</h3>
                    <p>{data.what_changed}</p>
                  </div>
                )}
              </>
            )}

            {pane(
              "position",
              "Position risk",
              "How risky this stock is to hold. A higher score means lower risk.",
              <>
                <div className="sa-risk">
                  <div className="sa-risk-num" style={{ color: scoreColor(risk.score) }}>
                    {fmtNum(risk.score, 0)}
                    <small>/ 100</small>
                  </div>
                  <div>
                    <h3>{risk.label || "—"}</h3>
                    <p className="sa-muted sa-small" style={{ margin: "2px 0 0" }}>Position risk level</p>
                  </div>
                </div>
                <div className="sa-scale" role="img" aria-label={`Position risk score ${fmtNum(risk.score, 0)} out of 100`}>
                  <span className="sa-scale-bar" />
                  <span className="sa-scale-mark" style={{ left: `${riskPos}%` }} />
                </div>
                <div className="sa-scale-lbl"><span>Higher risk</span><span>Lower risk</span></div>
                {riskFactor && (
                  <div className="sa-risk-detail">
                    <FactorDetail f={riskFactor} />
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <aside className="sa-side">
          <div className="sa-card sa-card-score">
            <h3 className="sa-card-title">Jarvis Score</h3>
            <div className="sa-ringrow">
              <ScoreRing total={data.jarvis_score} parts={parts} />
              <div>
                <span className="sa-conf" style={{ color: confColor(data.jarvis_confidence) }}>
                  <i />
                  <span className="sa-muted">{data.jarvis_confidence || "—"} confidence</span>
                </span>
                {data.trend && data.trend !== "New" && (
                  <p className="sa-small sa-muted" style={{ margin: "8px 0 0" }}>
                    {trendText(data.trend)}
                    {data.score_change ? ` (${data.score_change > 0 ? "+" : ""}${data.score_change})` : ""}
                  </p>
                )}
              </div>
            </div>
            <ul className="sa-comp">
              {parts.map((p) => (
                <li key={p.key}>
                  <span>
                    {p.label} <span className="sa-w">{Math.round(p.weight * 100)}%</span>
                  </span>
                  <strong>{isNum(p.score) ? Math.round(p.score) : <span className="sa-na">Not available</span>}</strong>
                  <span className="sa-bar">
                    <i style={{ width: `${p.score || 0}%`, background: scoreColor(p.score) }} />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="sa-card sa-card-sm sa-notes">
            <h3 className="sa-card-title">About this score</h3>
            <p style={{ margin: 0 }}>
              Methodology {data.methodology_version || "1.0"}. Data from company filings, consensus estimates and market prices via Alpha Vantage; qualitative factors judged by AI from the latest earnings call and news.
            </p>
            {(data.missing_inputs || []).length > 0 && (
              <ul>{data.missing_inputs.slice(0, 5).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
            )}
          </div>
        </aside>
      </div>

      <p className="sa-disclaimer">
        This analysis is provided for informational purposes only and is not a recommendation to buy, sell or hold any security. Jarvis Scores are model outputs based on data available at the time of calculation and may change.
      </p>
    </div>
  );
}

// ─── HOME VIEW ───────────────────────────────────────────────────────────────
let TICKER_CACHE: TickerRecord[] | null = null;

function HomeView({ onSearch }: { onSearch: (ticker: string) => void }) {
  const [tickers, setTickers] = useState<TickerRecord[]>(TICKER_CACHE || []);
  const [tickersLoading, setTickersLoading] = useState(!TICKER_CACHE);
  const [tickersError, setTickersError] = useState("");

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TickerRecord | null>(null);
  const [error, setError] = useState("");

  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (TICKER_CACHE) return;
    let cancelled = false;
    async function loadTickers() {
      setTickersLoading(true);
      setTickersError("");
      try {
        const res = await fetch(TICKERS_API);
        if (!res.ok) throw new Error(`Failed to load tickers (${res.status})`);
        const json = await res.json();
        const content: TickerRecord[] = Array.isArray(json) ? json : json?.content || [];
        if (!cancelled) {
          TICKER_CACHE = content;
          setTickers(content);
        }
      } catch {
        if (!cancelled) setTickersError("Couldn't load the ticker list. You can still type a ticker.");
      } finally {
        if (!cancelled) setTickersLoading(false);
      }
    }
    loadTickers();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filteredTickers = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    const hits = tickers.filter(
      (t) => t.stockName?.toUpperCase().includes(q) || t.company?.toUpperCase().includes(q)
    );
    const rank = (t: TickerRecord) =>
      t.stockName?.toUpperCase() === q ? 0 : t.stockName?.toUpperCase().startsWith(q) ? 1 : 2;
    return hits.sort((a, b) => rank(a) - rank(b)).slice(0, 50);
  }, [query, tickers]);

  const handleQueryChange = (v: string) => {
    setQuery(v.toUpperCase().replace(/\s/g, ""));
    setOpen(true);
    if (selected) setSelected(null);
    if (error) setError("");
  };

  const handleSelectTicker = (t: TickerRecord) => {
    setSelected(t);
    setQuery(t.stockName.toUpperCase());
    setOpen(false);
    setError("");
  };

  const handleClear = () => {
    setSelected(null);
    setQuery("");
    setOpen(false);
  };

  const handleChipClick = (symbol: string) => {
    const match = tickers.find((t) => t.stockName?.toUpperCase() === symbol);
    if (match) handleSelectTicker(match);
    else {
      setSelected(null);
      setQuery(symbol);
      setError("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = (selected?.stockName || query).trim().toUpperCase();
    if (!TICKER_RE.test(sym)) {
      setError("Enter a stock ticker, for example AAPL.");
      return;
    }
    if (!selected && tickers.length && !tickers.some((t) => t.stockName?.toUpperCase() === sym)) {
      setError(`${sym} isn't in the ticker list.`);
      return;
    }
    onSearch(sym);
  };

  return (
    <div className="ta-root ta-home">
      <div className="ta-orb">
        <Icon type="sparkle" />
      </div>

      <h1 className="ta-home-title">
        What equity would you
        <br />
        like to <span>analyze?</span>
      </h1>
      <p className="ta-home-sub">
        Enter a ticker to get the Jarvis Score, scored across twelve factors with the evidence behind each one.
      </p>

      <form onSubmit={handleSubmit} className="ta-ticker-form">
        <div className="ta-ticker-field" ref={wrapRef}>
          <label htmlFor="ta-ticker-input">Ticker</label>
          <div className="ta-ticker-combobox">
            <input
              id="ta-ticker-input"
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => query.trim() && setOpen(true)}
              placeholder={tickersLoading ? "Loading tickers…" : "Search ticker or company (e.g. AAPL)"}
              autoComplete="off"
              spellCheck={false}
              aria-label="Ticker"
            />
            {query && (
              <button type="button" className="ta-clear-btn" onClick={handleClear} aria-label="Clear">
                <Icon type="close" />
              </button>
            )}
            {open && query.trim() && (
              <div className="ta-ticker-dropdown" role="listbox">
                {tickersLoading ? (
                  <div className="ta-ticker-dropdown-msg">Loading tickers…</div>
                ) : tickersError ? (
                  <div className="ta-ticker-dropdown-msg">{tickersError}</div>
                ) : filteredTickers.length === 0 ? (
                  <div className="ta-ticker-dropdown-msg">No matches found.</div>
                ) : (
                  filteredTickers.map((t) => (
                    <button
                      type="button"
                      key={t.idStock}
                      className="ta-ticker-option"
                      role="option"
                      onClick={() => handleSelectTicker(t)}
                    >
                      <span className="ta-ticker-symbol">{t.stockName}</span>
                      <span className="ta-ticker-company">{t.company}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <button type="submit" className="ta-generate-btn">
          Generate Report
          <Icon type="arrow" />
        </button>
      </form>

      {error && (
        <p className="ta-search-error" role="alert">
          {error}
        </p>
      )}

      <div className="ta-chips">
        {COMMON.map((t) => (
          <button key={t} className="ta-chip" type="button" onClick={() => handleChipClick(t)} disabled={tickersLoading}>
            {t}
          </button>
        ))}
      </div>

      <p className="ta-disclaimer">Not investment advice. For informational purposes only.</p>

      <style jsx>{`
        .ta-ticker-form { display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 480px; margin: 0 auto; }
        .ta-ticker-field { display: flex; flex-direction: column; gap: 6px; text-align: left; position: relative; }
        .ta-ticker-field label { font-size: 12px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase; color: var(--muted, #8a9490); }
        .ta-ticker-combobox { position: relative; }
        .ta-ticker-combobox input {
          width: 100%; box-sizing: border-box; padding: 12px 40px 12px 14px; border-radius: 12px;
          border: 1px solid var(--line, #2a3530); background: var(--card-2, #12211a); color: var(--ink, #e8f0eb);
          font-size: 14px; letter-spacing: 0.04em; outline: none; transition: border-color 0.2s ease;
        }
        .ta-ticker-combobox input:focus { border-color: var(--blue, #4fa772); }
        .ta-clear-btn { position: absolute; top: 50%; right: 8px; transform: translateY(-50%); width: 26px; height: 26px; border: none; background: transparent; color: var(--muted, #8a9490); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
        .ta-clear-btn :global(svg) { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; }
        .ta-ticker-dropdown { position: absolute; top: calc(100% + 6px); left: 0; right: 0; max-height: 260px; overflow-y: auto; background: var(--card-2, #12211a); border: 1px solid var(--line, #2a3530); border-radius: 12px; box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35); z-index: 30; }
        .ta-ticker-dropdown-msg { padding: 14px; font-size: 13px; color: var(--muted, #8a9490); }
        .ta-ticker-option { display: flex; justify-content: space-between; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border: none; background: transparent; color: var(--ink, #e8f0eb); text-align: left; cursor: pointer; font-size: 13.5px; }
        .ta-ticker-option:hover { background: var(--row-hover, #1a2a22); }
        .ta-ticker-symbol { font-weight: 700; flex-shrink: 0; }
        .ta-ticker-company { color: var(--muted, #8a9490); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-left: 12px; }
        .ta-generate-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 13px 22px; border-radius: 999px; border: none; background: var(--blue, #4fa772); color: #fff; font-weight: 700; font-size: 14.5px; cursor: pointer; transition: transform 0.15s ease, background 0.2s ease; }
        .ta-generate-btn:hover { transform: translateY(-1px); }
        .ta-generate-btn :global(svg) { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2.2; }
      `}</style>
    </div>
  );
}

// ─── PAGE ROOT ───────────────────────────────────────────────────────────────
type ViewState = "home" | "generating" | "ready";

export default function StockAnalysisPage() {
  const [view, setView] = useState<ViewState>("home");
  const [ticker, setTicker] = useState("");
  const [data, setData] = useState<any>(null);
  const [fromSaved, setFromSaved] = useState(false);

  const [nodeState, setNodeState] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<{ t: string; label: string; text: string; cls: string }[]>([]);
  const [error, setError] = useState("");
  const [startedAt, setStartedAt] = useState(Date.now());
  const runIdRef = useRef(0); // bumping this cancels any run in flight

  useEffect(() => () => { runIdRef.current += 1; }, []);

  const setNode = useCallback(
    (id: string, st: string) => setNodeState((p) => ({ ...p, [id]: st })),
    []
  );

  const run = useCallback(
    async (sym: string) => {
      // 1) Cache: already analysed -> open instantly, no animation, no API call
      const cached = getCached(sym);
      if (cached) {
        setTicker(sym);
        setData(cached.data);
        setFromSaved(true);
        setView("ready");
        if (typeof window !== "undefined") window.scrollTo({ top: 0 });
        return;
      }

      // 2) Not cached: play the animation while the API runs
      const myId = ++runIdRef.current;
      const t0 = Date.now();
      const stamp = () => {
        const s = Math.floor((Date.now() - t0) / 1000);
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
      };
      setTicker(sym);
      setNodeState({});
      setLogs([]);
      setError("");
      setStartedAt(t0);
      setView("generating");

      const log = (label: string, text: string, cls?: string) =>
        setLogs((prev) => [...prev, { t: stamp(), label, text, cls: cls || "" }].slice(-7));

      try {
        const result = await runPipeline({
          stages: STAGES,
          setNode,
          log,
          isCancelled: () => runIdRef.current !== myId,
          request: () =>
            callWebhook(
              SCORE_WEBHOOK_URL,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ticker: sym }),
              },
              REQUEST_TIMEOUT_MS
            ),
          onEarlyResponse: (r: any, l: any) => {
            if (r && r.source === "cache") l("Check saved scores", `Using the saved score from ${fmtDate(r.calculated_at)}`, "ok");
          },
        });
        if (!result || result.jarvis_score === undefined) {
          throw new Error(result && result.message ? result.message : "The analysis came back incomplete. Please try again.");
        }
        await sleep(reduceMotion() ? 0 : 900);
        if (runIdRef.current !== myId) return;
        setCached(sym, result);
        setData(result);
        setFromSaved(false);
        setView("ready");
        window.scrollTo({ top: 0 });
      } catch (e: any) {
        if (e === CANCELLED || runIdRef.current !== myId) return;
        setError(e?.message || "Something went wrong while analysing this stock.");
      }
    },
    [setNode]
  );

  const goHome = () => {
    runIdRef.current += 1; // cancel anything in flight
    setError("");
    setData(null);
    setView("home");
  };

  return (
    <>
      <style>{SA_STYLES}</style>
      {view === "home" && <HomeView onSearch={run} />}
      {view === "generating" && (
        <GeneratingView
          ticker={ticker}
          nodeState={nodeState}
          logs={logs}
          error={error}
          startedAt={startedAt}
          onCancel={goHome}
          onRetry={() => run(ticker)}
        />
      )}
      {view === "ready" && data && <ReportView data={data} fromSaved={fromSaved} onAgain={goHome} />}
    </>
  );
}

// ─── STYLES (animation + report) ─────────────────────────────────────────────
const SA_STYLES = `
.sa-wrap { width: 100%; max-width: 1240px; margin: 0 auto; padding: 8px 0 64px; box-sizing: border-box;
  --sa-ink: var(--ink, #13261C); --sa-ink2: var(--muted, #6b7b72); --sa-line: var(--line, #D5DED7);
  --sa-card: var(--card-2, #fff); --sa-brand: var(--blue, #1E6B3A); }
.sa-wrap *, .sa-wrap *::before, .sa-wrap *::after { box-sizing: border-box; }

/* ---------- run panel ---------- */
.sa-run-panel {
  /* light theme: green base */
    --panel: #0E2B1D;
  --panel-2: #133626; --panel-active:rgb(52,104,10); --panel-final:rgb(72,92,16);
  --signal:#EAFFCF; --sig-rgb:234,255,207; --brass:#FFE08A; --bad:#B4493B;
  --sa-sub:rgba(255,255,255,.82); --sa-logtxt:rgba(255,255,255,.9); --sa-time:rgba(255,255,255,.6); --sa-dot:rgba(255,255,255,.14);
  background: var(--panel); color:#E3EFE7; border-radius: 18px; overflow:hidden; position:relative; }
.sa-run-panel::before { content:""; position:absolute; inset:0; pointer-events:none;
  background-image: radial-gradient(var(--sa-dot) 1px, transparent 1px); background-size:22px 22px; }
.sa-run-head { position:relative; display:flex; justify-content:space-between; align-items:flex-start; gap:16px; padding:26px 28px 8px; }
.sa-run-head h2 { font-family: Georgia, 'Times New Roman', serif; font-weight:500; font-size:26px; margin:0 0 4px; color:#F2F8F4; letter-spacing:-.01em; }
.sa-run-head p { margin:0; color:var(--sa-sub); font-size:15px; }
.sa-run-meta { display:flex; align-items:center; gap:14px; flex-shrink:0; }
.sa-clock { font-size:15px; color:#CFE3D6; }
.sa-clock b { font-weight:600; color:#fff; font-variant-numeric: tabular-nums; }
.sa-ghost { background:transparent; color:#CFE3D6; border:1px solid rgba(207,227,214,.28); border-radius:999px; padding:8px 16px; font-size:14px; font-weight:500; cursor:pointer; }
.sa-ghost:hover { border-color: rgba(207,227,214,.6); }
.sa-graph { position:relative; margin:8px 12px 0; }
.sa-wires { position:absolute; inset:0; overflow:visible; }
.sa-wire { fill:none; stroke: rgba(var(--sig-rgb),.16); stroke-width:2; transition: stroke .4s; }
.sa-wire.flow { stroke: rgba(var(--sig-rgb),.55); stroke-dasharray:5 9; animation: sa-dash .9s linear infinite; }
.sa-wire.done { stroke: rgba(var(--sig-rgb),.5); }
.sa-wire.err { stroke: rgba(180,73,59,.7); }
@keyframes sa-dash { to { stroke-dashoffset:-28; } }
.sa-pulse-dot { fill: var(--signal); filter: drop-shadow(0 0 4px rgba(var(--sig-rgb),.9)); }
.sa-node { position:absolute; width:120px; display:flex; flex-direction:column; align-items:center; text-align:center; }
.sa-box { position:relative; width:58px; height:58px; border-radius:14px; background: var(--panel-2); border:1.5px solid rgba(227,239,231,.16);
  display:grid; place-items:center; color: rgba(227,239,231,.45); transition: border-color .3s, color .3s, background .3s; }
.sa-box > svg { width:26px; height:26px; }
.sa-label { background: var(--panel); padding:1px 5px; border-radius:5px; position:relative; margin-top:8px; font-size:13px; line-height:1.25;
  color: rgba(227,239,231,.55); max-width:118px; transition: color .3s; }
.sa-node.compact { width:168px; flex-direction:row; align-items:center; text-align:left; gap:10px; }
.sa-node.compact .sa-box { width:38px; height:38px; border-radius:10px; flex-shrink:0; }
.sa-node.compact .sa-box > svg { width:19px; height:19px; }
.sa-node.compact .sa-label { margin:0; max-width:122px; }
.sa-node.compact .sa-badge { top:-7px; right:-7px; width:18px; height:18px; }
.sa-node.compact .sa-badge svg { width:18px; height:18px; }
.sa-badge { position:absolute; top:-8px; right:-8px; width:22px; height:22px; border-radius:50%; display:none; place-items:center; background: var(--panel); }
.sa-badge svg { width:22px; height:22px; }
.sa-node.active .sa-box { border-color: var(--signal); color: var(--signal); background:var(--panel-active); animation: sa-glow 1.6s ease-in-out infinite; }
.sa-node.active .sa-label, .sa-node.done .sa-label { color:#EAF4EE; }
.sa-node.active .sa-badge, .sa-node.done .sa-badge, .sa-node.err .sa-badge { display:grid; }
.sa-spin { animation: sa-rot .9s linear infinite; transform-origin:50% 50%; }
.sa-node.done .sa-box { border-color: rgba(var(--sig-rgb),.55); color:#CFEFDC; }
.sa-node.err .sa-box { border-color: var(--bad); color:#F1B7AE; }
.sa-node.final.done .sa-box { border-color: var(--brass); color: var(--brass); background:var(--panel-final); }
@keyframes sa-glow { 0%,100% { box-shadow:0 0 0 0 rgba(var(--sig-rgb),.35); } 50% { box-shadow:0 0 0 9px rgba(var(--sig-rgb),0); } }
@keyframes sa-rot { to { transform: rotate(360deg); } }
.sa-log { position:relative; margin:12px 28px 26px; border-top:1px solid rgba(227,239,231,.12); padding-top:14px; max-height:196px; overflow:hidden; }
.sa-log ol { list-style:none; margin:0; padding:0; display:grid; gap:7px; }
.sa-log li { display:grid; grid-template-columns:52px 168px 1fr; gap:12px; font-size:14px; color:var(--sa-logtxt); animation: sa-logIn .35s ease-out; }
.sa-log li time { color:var(--sa-time); }
.sa-log li strong { font-weight:500; color:#E3EFE7; }
.sa-log li.ok span { color: var(--signal); }
.sa-log li.bad span { color:#F1B7AE; }
@keyframes sa-logIn { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform:none; } }

.sa-error-box { margin-top:20px; background:#FBEDEA; border:1px solid #E9C4BC; color:#6B2A20; border-radius:12px; padding:18px 20px;
  display:flex; justify-content:space-between; gap:16px; align-items:center; flex-wrap:wrap; }
.sa-error-box p { margin:0; font-weight:600; }
.sa-error-actions { display:flex; gap:10px; }

[data-theme="dark"] .sa-run-panel {
  /* dark theme: bluish base */
  --panel:#0F1826; --panel-2:#16243A; --panel-active:#173254; --panel-final:#2A3A22;
  --signal:#7BE0A6; --sig-rgb:123,224,166; --brass:#C49A3C;
  --sa-sub:#9DB8A8; --sa-logtxt:#B9D0C2; --sa-time:#6F8F7D; --sa-dot:rgba(127,178,255,.10);
}

/* ---------- buttons ---------- */
.sa-btn-main, .sa-btn-quiet { display:inline-flex; align-items:center; justify-content:center; gap:8px; border-radius:999px; padding:10px 20px; font-weight:600; font-size:14px; cursor:pointer; line-height:1.2; }
.sa-btn-main { background: var(--sa-brand); color:#fff; border:1px solid transparent; }
.sa-btn-main:hover { filter: brightness(1.08); }
.sa-btn-quiet { background:transparent; color: var(--sa-ink); border:1px solid var(--sa-line); }
.sa-btn-quiet:hover { border-color: var(--sa-ink2); }
.sa-btn-main svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:2; }
.sa-error-box .sa-btn-quiet { color:#6B2A20; border-color:#D9A99F; }

/* ---------- report ---------- */
.sa-report { color: var(--sa-ink); animation: sa-rise .4s ease-out; font-variant-numeric: tabular-nums; }
@keyframes sa-rise { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform:none; } }
.sa-res-top { display:flex; justify-content:space-between; align-items:flex-end; gap:20px; flex-wrap:wrap; }
.sa-res-top h1 { font-weight:700; font-size:clamp(26px,3vw,34px); line-height:1.15; margin:10px 0 0; letter-spacing:-.015em; color: var(--sa-ink); }
.sa-chips { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.sa-ticker { font-weight:700; font-size:13px; letter-spacing:.06em; padding:4px 10px; border-radius:6px; background: var(--sa-brand); color:#fff; }
.sa-chip { font-size:12.5px; font-weight:600; padding:4px 10px; border-radius:6px; border:1px solid var(--sa-line); color: var(--sa-ink2); }
.sa-acts { display:flex; gap:10px; flex-wrap:wrap; }

.sa-stats { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); margin-top:22px; background: var(--sa-card); border:1px solid var(--sa-line); border-radius:14px; }
.sa-stats > div { padding:16px 20px; display:grid; gap:2px; align-content:start; }
.sa-stats > div + div { border-left:1px solid var(--sa-line); }
.sa-stats span { font-size:11.5px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color: var(--sa-ink2); }
.sa-stats b { font-size:22px; font-weight:700; color: var(--sa-ink); line-height:1.25; }
.sa-stats b.sa-stat-text { font-size:16px; padding-top:4px; }
.sa-stats small { font-size:12.5px; color: var(--sa-ink2); }

.sa-grid { display:grid; grid-template-columns: minmax(0,1fr) 380px; gap:20px; margin-top:20px; align-items:start; }
.sa-panel { background: var(--sa-card); border:1px solid var(--sa-line); border-radius:14px; display:flex; flex-direction:column; min-height:440px; max-height: calc(100vh - 150px); overflow:hidden; }
.sa-tabs { display:flex; padding:0 8px; border-bottom:1px solid var(--sa-line); overflow-x:auto; flex-shrink:0; scrollbar-width:none; }
.sa-tabs::-webkit-scrollbar { display:none; }
.sa-tab { flex:1 1 auto; background:none; border:0; border-bottom:2px solid transparent; margin-bottom:-1px; padding:15px 14px; font-size:13.5px; font-weight:600; color: var(--sa-ink2); cursor:pointer; white-space:nowrap; display:inline-flex; align-items:center; justify-content:center; gap:7px; }
.sa-tab:hover { color: var(--sa-ink); }
.sa-tab.on { color: var(--sa-brand); border-bottom-color: var(--sa-brand); }
.sa-tab-count { font-size:11px; font-weight:700; min-width:20px; text-align:center; padding:1px 6px; border-radius:999px; background: rgba(138,148,144,.18); color: var(--sa-ink2); }
.sa-tab.on .sa-tab-count { background: var(--sa-brand); color:#fff; }
.sa-panel-body { flex:1; min-height:0; overflow-y:auto; padding:26px 30px 30px; }
.sa-pane.closed { display:none; }
.sa-pane-head { margin-bottom:20px; }
.sa-pane-head h2 { font-size:19px; font-weight:700; margin:0 0 4px; color: var(--sa-ink); letter-spacing:-.01em; }
.sa-pane-head p { margin:0; font-size:14px; color: var(--sa-ink2); }
.sa-lead { font-size:20px; line-height:1.5; font-weight:600; color: var(--sa-ink); margin:0 0 14px; letter-spacing:-.005em; }
.sa-body { font-size:15.5px; line-height:1.7; color: var(--sa-ink); margin:0; max-width:80ch; }
.sa-sw { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:28px; padding-top:22px; border-top:1px solid var(--sa-line); }
.sa-sw h3, .sa-note-block h3 { margin:0 0 10px; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color: var(--sa-ink2); }
.sa-mini { list-style:none; margin:0; padding:0; }
.sa-mini li { display:flex; justify-content:space-between; gap:12px; padding:9px 0; border-bottom:1px solid var(--sa-line); font-size:14.5px; color: var(--sa-ink); }
.sa-mini li:last-child { border-bottom:0; }
.sa-mini b { font-weight:700; }
.sa-items { list-style:none; margin:0; padding:0; display:grid; gap:10px; }
.sa-item { display:grid; grid-template-columns:28px 1fr; gap:12px; align-items:start; padding:14px 16px; border:1px solid var(--sa-line); border-left-width:3px; border-radius:10px; font-size:15.5px; line-height:1.5; color: var(--sa-ink); }
.sa-item.good { border-left-color:#2F8F55; }
.sa-item.warn { border-left-color:#B98419; }
.sa-item-n { font-size:12px; font-weight:700; color: var(--sa-ink2); padding-top:3px; }
.sa-note-block { margin-top:26px; padding:16px 18px; border:1px solid var(--sa-line); border-radius:10px; }
.sa-note-block p { margin:0; color: var(--sa-ink2); font-size:15px; line-height:1.6; }
.sa-body-first { margin-top:0; }

.sa-factors { list-style:none; margin:0; padding:0; border:1px solid var(--sa-line); border-radius:10px; overflow:hidden; }
.sa-factors > li + li { border-top:1px solid var(--sa-line); }
.sa-factor-btn { width:100%; background:none; border:0; padding:13px 16px; display:grid; grid-template-columns: 34px minmax(0,1fr) 130px 46px 16px; gap:14px; align-items:center; text-align:left; cursor:pointer; color: var(--sa-ink); }
.sa-factor-btn:hover { background: rgba(138,148,144,.07); }
.sa-fid { font-size:11px; font-weight:700; color: var(--sa-ink2); letter-spacing:.04em; }
.sa-nm { font-weight:600; font-size:14.5px; }
.sa-nm small { display:block; font-weight:400; color: var(--sa-ink2); font-size:12.5px; margin-top:1px; }
.sa-meter { height:6px; background: rgba(138,148,144,.22); border-radius:3px; overflow:hidden; }
.sa-meter i { display:block; height:100%; border-radius:3px; }
.sa-sc { font-weight:700; font-size:13px; text-align:center; padding:3px 0; border:1.5px solid; border-radius:7px; }
.sa-chev { color: var(--sa-ink2); display:inline-flex; transition: transform .2s; }
.sa-chev svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:2; }
.sa-factor-btn[aria-expanded="true"] .sa-chev { transform: rotate(180deg); }
.sa-factor-detail { padding:2px 16px 18px 64px; display:grid; gap:10px; font-size:14.5px; line-height:1.5; color: var(--sa-ink); }
.sa-factor-detail.closed { display:none; }
.sa-factor-detail p { margin:0; }
.sa-lbl { color: var(--sa-ink2); font-weight:700; font-size:12px; letter-spacing:.05em; text-transform:uppercase; }
.sa-ev { margin:4px 0 0; padding-left:18px; }
.sa-ev li + li { margin-top:4px; }
.sa-pill { display:inline-block; font-size:12px; padding:2px 9px; border-radius:999px; color: var(--sa-ink2); border:1px solid var(--sa-line); }

.sa-risk { display:flex; align-items:center; gap:20px; }
.sa-risk-num { font-size:52px; font-weight:700; line-height:1; letter-spacing:-.02em; }
.sa-risk-num small { font-size:15px; font-weight:600; color: var(--sa-ink2); margin-left:6px; letter-spacing:0; }
.sa-risk h3 { margin:0; font-size:20px; font-weight:700; color: var(--sa-ink); }
.sa-scale { position:relative; margin:26px 0 8px; height:12px; }
.sa-scale-bar { position:absolute; inset:0; border-radius:6px; background: linear-gradient(90deg, #B4493B 0 50%, #B98419 50% 70%, #2F8F55 70% 100%); opacity:.85; }
.sa-scale-mark { position:absolute; top:50%; width:18px; height:18px; border-radius:50%; background:#fff; border:3px solid var(--sa-ink); transform: translate(-50%,-50%); box-shadow:0 1px 4px rgba(0,0,0,.35); }
.sa-scale-lbl { display:flex; justify-content:space-between; font-size:12px; color: var(--sa-ink2); }
.sa-risk-detail { display:grid; gap:10px; font-size:14.5px; color: var(--sa-ink); margin-top:26px; padding-top:22px; border-top:1px solid var(--sa-line); line-height:1.5; }
.sa-risk-detail p { margin:0; }

.sa-side { display:grid; gap:16px; align-content:start; position:sticky; top:16px; }
.sa-card { background: var(--sa-card); border:1px solid var(--sa-line); border-radius:14px; padding:22px; }
.sa-card-sm { padding:18px 22px; }
.sa-card-title { margin:0 0 14px; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color: var(--sa-ink2); }
.sa-ringrow { display:grid; grid-template-columns:150px 1fr; gap:18px; align-items:center; }
.sa-ring { position:relative; width:150px; height:150px; }
.sa-ring svg { width:100%; height:100%; transform: rotate(-90deg); }
.sa-ring-centre { position:absolute; inset:0; display:grid; place-content:center; text-align:center; }
.sa-ring-num { font-size:44px; font-weight:700; line-height:1; letter-spacing:-.02em; }
.sa-ring-of { color: var(--sa-ink2); font-size:12px; margin-top:4px; }
.sa-conf { display:inline-flex; align-items:center; gap:6px; font-size:13px; }
.sa-conf i { width:8px; height:8px; border-radius:50%; background: currentColor; display:inline-block; }
.sa-comp { list-style:none; margin:20px 0 0; padding:16px 0 0; border-top:1px solid var(--sa-line); display:grid; gap:12px; }
.sa-comp li { display:grid; grid-template-columns:1fr auto; gap:5px 12px; font-size:14px; color: var(--sa-ink); }
.sa-bar { grid-column:1 / -1; height:6px; border-radius:3px; background: rgba(138,148,144,.22); overflow:hidden; }
.sa-bar i { display:block; height:100%; border-radius:3px; }
.sa-w { color: var(--sa-ink2); font-weight:400; }
.sa-na { color: var(--sa-ink2); font-weight:400; }
.sa-muted { color: var(--sa-ink2); }
.sa-small { font-size:14px; }
.sa-notes { font-size:13.5px; line-height:1.55; color: var(--sa-ink2); }
.sa-notes ul { padding-left:18px; margin:8px 0 0; }
.sa-disclaimer { margin-top:28px; font-size:12.5px; color: var(--sa-ink2); max-width:100ch; }

@media (max-width: 1100px) {
  .sa-stats { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .sa-stats > div:nth-child(3) { border-left:0; }
  .sa-stats > div:nth-child(n+3) { border-top:1px solid var(--sa-line); }
}
@media (max-width: 960px) {
  .sa-grid { grid-template-columns:1fr; }
  .sa-side { order:-1; position:static; }
  .sa-panel { max-height:none; }
  .sa-panel-body { overflow:visible; }
}
@media (max-width: 640px) {
  .sa-run-head { flex-direction:column; padding:22px 18px 4px; }
  .sa-log { margin:10px 18px 20px; }
  .sa-log li { grid-template-columns:44px 1fr; }
  .sa-log li strong { display:none; }
  .sa-ringrow { grid-template-columns:1fr; justify-items:start; }
  .sa-panel-body { padding:20px 18px 24px; }
  .sa-factor-btn { grid-template-columns: minmax(0,1fr) 70px 42px 16px; gap:10px; padding:12px; }
  .sa-fid { display:none; }
  .sa-factor-detail { padding-left:12px; }
  .sa-sw { grid-template-columns:1fr; }
  .sa-stats b { font-size:19px; }
}
@media (prefers-reduced-motion: reduce) {
  .sa-wrap *, .sa-wrap *::before, .sa-wrap *::after { animation: none !important; transition: none !important; }
  .sa-wire.flow { stroke-dasharray:none; }
}

/* ---------- print / Save PDF: a flat document — every section and factor expanded, tabs and buttons hidden ---------- */
@media print {
  body * { visibility: hidden !important; }
  .sa-report, .sa-report * { visibility: visible !important; }
  .sa-report { position:absolute; left:0; top:0; width:100%; max-width:none; padding:0; animation:none; color:#13261C;
    --sa-ink:#13261C; --sa-ink2:#4B5E53; --sa-line:#D5DED7; --sa-card:#fff; --sa-brand:#1E6B3A;
    -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .sa-noprint { display:none !important; }
  .sa-grid { display:flex; flex-direction:column; gap:0; margin-top:16px; }
  .sa-side { order:-1; position:static; display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px; align-items:start; }
  .sa-panel { display:block; max-height:none; min-height:0; border:0; border-radius:0; overflow:visible; }
  .sa-panel-body { overflow:visible; padding:0; }
  .sa-pane, .sa-pane.closed { display:block !important; margin-bottom:26px; }
  .sa-factor-detail.closed { display:grid !important; }
  .sa-card, .sa-item, .sa-factors > li, .sa-note-block { break-inside: avoid; }
  .sa-pane-head { break-after: avoid; }

  #sa-pane-risks {margin-bottom: 3rem;}
}
`;

// "use client";

// import React, {
//   useState,
//   useEffect,
//   useRef,
//   useCallback,
//   useMemo,
// } from "react";
// import jsPDF from "jspdf";
// import autoTable from "jspdf-autotable";

// // ─── CONFIG ──────────────────────────────────────────────────────────────────
// const TICKERS_API = "/api/proxy?api=getTickers&page=0&size=13000";
// const REPORT_WEBHOOK_URL =
//   "https://n8n.srv1375926.hstgr.cloud/webhook/5df999e7-932a-4810-a956-b22a083ffd67";
// const REPORT_AUTHOR = "LBWM Research";
// const JARVIS_LOGO_URL = "https://jarvisintelligence.ai/images/J_logo.png";

// // ─── TYPES ───────────────────────────────────────────────────────────────────
// type IconType =
//   | "chart" | "users" | "newspaper" | "dollar" | "arrows" | "search"
//   | "trend" | "shield" | "star" | "sparkle" | "arrow" | "bars"
//   | "doc" | "chevron" | "brain" | "external" | "check" | "close";

// interface TickerRecord {
//   idStock: number;
//   stockName: string;
//   company: string;
//   sector?: string | null;
//   industry?: string | null;
//   country?: string | null;
//   marketCapital?: string | null;
//   logoFileDetails?: string | null;
//   assetType?: string | null;
// }

// interface TickerSelection {
//   ticker: string;
//   company: string;
// }

// interface ChartData {
//   title?: string;
//   labels?: string[];
//   values?: number[];
//   values_usd_b?: number[];
//   source?: string;
// }

// interface ReportPage1 {
//   company_name?: string;
//   ticker?: string;
//   exchange?: string;
//   report_date?: string;
//   rating?: string;
//   stock_price?: string;
//   stock_price_date?: string;
//   company_size?: string;
//   company_rank?: string;
//   sector?: string;
//   industry?: string;
//   author?: string;
//   tagline?: string;
//   in_this_fresh_look?: {
//     summary_of_business?: string;
//     recent_developments?: string;
//     competitive_environment?: string;
//     conclusions_recommendations?: string;
//   };
//   grab_and_go_thesis?: string;
// }

// interface ReportPage2 {
//   data_as_of?: string;
//   key_metrics?: Record<string, string | null>;
//   insider_transactions?: string;
//   summary_of_business?: string[];
//   annual_report_url?: string;
//   revenue_pie_chart?: ChartData;
// }

// interface ProductItem {
//   name?: string;
//   description?: string;
// }
// interface ReportPage3 {
//   product_and_service_portfolio?: {
//     intro?: string;
//     products?: ProductItem[];
//   };
//   key_segment_chart?: ChartData;
// }

// interface StrategicTheme {
//   title?: string;
//   paragraphs?: string[];
// }
// interface ReportPage4 {
//   strategic_themes?: StrategicTheme[];
//   capex_chart?: ChartData;
// }

// interface AnalysisReport {
//   page_1?: ReportPage1;
//   page_2?: ReportPage2;
//   page_3?: ReportPage3;
//   page_4?: ReportPage4;
//   sources?: string[];
// }

// // ─── SVG ICONS ───────────────────────────────────────────────────────────────
// const Icon = ({ type }: { type: IconType }) => {
//   const paths: Record<IconType, React.ReactNode> = {
//     chart: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
//     users: (
//       <>
//         <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
//         <circle cx="9" cy="7" r="4" />
//         <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
//         <path d="M16 3.13a4 4 0 0 1 0 7.75" />
//       </>
//     ),
//     newspaper: (
//       <>
//         <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
//         <path d="M18 14h-8" />
//         <path d="M15 18h-5" />
//         <path d="M10 6h8v4h-8z" />
//       </>
//     ),
//     dollar: (
//       <>
//         <line x1="12" y1="1" x2="12" y2="23" />
//         <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
//       </>
//     ),
//     arrows: (
//       <>
//         <polyline points="17 1 21 5 17 9" />
//         <path d="M3 11V9a4 4 0 0 1 4-4h14" />
//         <polyline points="7 23 3 19 7 15" />
//         <path d="M21 13v2a4 4 0 0 1-4 4H3" />
//       </>
//     ),
//     search: (
//       <>
//         <circle cx="11" cy="11" r="8" />
//         <line x1="21" y1="21" x2="16.65" y2="16.65" />
//       </>
//     ),
//     trend: (
//       <>
//         <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
//         <polyline points="17 6 23 6 23 12" />
//       </>
//     ),
//     shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
//     star: (
//       <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
//     ),
//     sparkle: (
//       <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
//     ),
//     arrow: <path d="M14 5l7 7m0 0l-7 7m7-7H3" />,
//     bars: (
//       <>
//         <line x1="3" y1="6" x2="21" y2="6" />
//         <line x1="3" y1="12" x2="21" y2="12" />
//         <line x1="3" y1="18" x2="21" y2="18" />
//       </>
//     ),
//     doc: (
//       <>
//         <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
//         <polyline points="14 2 14 8 20 8" />
//         <line x1="16" y1="13" x2="8" y2="13" />
//         <line x1="16" y1="17" x2="8" y2="17" />
//         <polyline points="10 9 9 9 8 9" />
//       </>
//     ),
//     chevron: <polyline points="6 9 12 15 18 9" />,
//     brain: (
//       <>
//         <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z" />
//         <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z" />
//       </>
//     ),
//     external: (
//       <>
//         <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
//         <polyline points="15 3 21 3 21 9" />
//         <line x1="10" y1="14" x2="21" y2="3" />
//       </>
//     ),
//     check: <polyline points="20 6 9 17 4 12" />,
//     close: (
//       <>
//         <line x1="18" y1="6" x2="6" y2="18" />
//         <line x1="6" y1="6" x2="18" y2="18" />
//       </>
//     ),
//   };
//   return (
//     <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
//       {paths[type] || paths.star}
//     </svg>
//   );
// };

// // ─── TIMER HOOK ──────────────────────────────────────────────────────────────
// function useTimer(running: boolean) {
//   const [elapsed, setElapsed] = useState(0);
//   const ref = useRef<ReturnType<typeof setInterval> | null>(null);
//   useEffect(() => {
//     if (running) {
//       ref.current = setInterval(() => setElapsed((e) => e + 1), 1000);
//     } else if (ref.current) {
//       clearInterval(ref.current);
//     }
//     return () => {
//       if (ref.current) clearInterval(ref.current);
//     };
//   }, [running]);
//   const reset = useCallback(() => setElapsed(0), []);
//   const fmt = (s: number) =>
//     `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
//   return { elapsed, fmt: fmt(elapsed), reset };
// }

// let TICKER_CACHE: TickerRecord[] | null = null;

// // ─── HOME VIEW ───────────────────────────────────────────────────────────────
// function HomeView({ onSearch }: { onSearch: (sel: TickerSelection) => void }) {
//   const [tickers, setTickers] = useState<TickerRecord[]>(TICKER_CACHE || []);
//   const [tickersLoading, setTickersLoading] = useState(!TICKER_CACHE);
//   const [tickersError, setTickersError] = useState("");

//   const [query, setQuery] = useState("");
//   const [open, setOpen] = useState(false);
//   const [selected, setSelected] = useState<TickerRecord | null>(null);
//   const [error, setError] = useState("");

//   const wrapRef = useRef<HTMLDivElement>(null);

//   const COMMON = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "NFLX"];

//   useEffect(() => {
//     if (TICKER_CACHE) return;
//     let cancelled = false;
//     async function loadTickers() {
//       setTickersLoading(true);
//       setTickersError("");
//       try {
//         const res = await fetch(TICKERS_API);
//         if (!res.ok) throw new Error(`Failed to load tickers (${res.status})`);
//         const json = await res.json();
//         const content: TickerRecord[] = Array.isArray(json)
//           ? json
//           : json?.content || [];
//         if (!cancelled) {
//           TICKER_CACHE = content;
//           setTickers(content);
//         }
//       } catch (err) {
//         if (!cancelled) {
//           setTickersError("Couldn't load the ticker list. Please try again.");
//         }
//       } finally {
//         if (!cancelled) setTickersLoading(false);
//       }
//     }
//     loadTickers();
//     return () => {
//       cancelled = true;
//     };
//   }, []);

//   useEffect(() => {
//     const onClick = (e: MouseEvent) => {
//       if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
//         setOpen(false);
//       }
//     };
//     document.addEventListener("mousedown", onClick);
//     return () => document.removeEventListener("mousedown", onClick);
//   }, []);

//   const filteredTickers = useMemo(() => {
//     const q = query.trim().toUpperCase();
//     if (!q) return [];
//     return tickers
//       .filter(
//         (t) =>
//           t.stockName?.toUpperCase().includes(q) ||
//           t.company?.toUpperCase().includes(q),
//       )
//       .slice(0, 50);
//   }, [query, tickers]);

//   const handleQueryChange = (v: string) => {
//     setQuery(v);
//     setOpen(true);
//     if (selected) setSelected(null);
//     if (error) setError("");
//   };

//   const handleSelectTicker = (t: TickerRecord) => {
//     setSelected(t);
//     setQuery(`${t.stockName} — ${t.company}`);
//     setOpen(false);
//     setError("");
//   };

//   const handleClearSelection = () => {
//     setSelected(null);
//     setQuery("");
//     setOpen(false);
//   };

//   const handleChipClick = (symbol: string) => {
//     const match = tickers.find((t) => t.stockName?.toUpperCase() === symbol);
//     if (match) {
//       handleSelectTicker(match);
//     } else if (!tickersLoading) {
//       setError(`${symbol} isn't in the ticker list.`);
//     }
//   };

//   const handleSubmit = (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!selected) {
//       setError("Please select a ticker from the list.");
//       return;
//     }
//     onSearch({ ticker: selected.stockName, company: selected.company });
//   };

//   return (
//     <div className="ta-root ta-home">
//       <div className="ta-orb">
//         <Icon type="sparkle" />
//       </div>

//       <h1 className="ta-home-title">
//         What equity would you
//         <br />
//         like to <span>analyze?</span>
//       </h1>
//       <p className="ta-home-sub">
//         Select a ticker to generate a full equity research report as a
//         downloadable PDF.
//       </p>

//       <form onSubmit={handleSubmit} className="ta-ticker-form">
//         <div className="ta-ticker-field" ref={wrapRef}>
//           <label htmlFor="ta-ticker-input">Ticker</label>
//           <div className="ta-ticker-combobox">
//             <input
//               id="ta-ticker-input"
//               type="text"
//               value={query}
//               onChange={(e) => handleQueryChange(e.target.value)}
//               onFocus={() => query.trim() && setOpen(true)}
//               placeholder={
//                 tickersLoading
//                   ? "Loading tickers…"
//                   : "Search ticker or company (e.g. AAPL, Apple)"
//               }
//               autoComplete="off"
//               spellCheck={false}
//               aria-label="Search ticker or company"
//             />
//             {selected && (
//               <button
//                 type="button"
//                 className="ta-clear-btn"
//                 onClick={handleClearSelection}
//                 aria-label="Clear selection"
//               >
//                 <Icon type="close" />
//               </button>
//             )}
//             {open && query.trim() && (
//               <div className="ta-ticker-dropdown" role="listbox">
//                 {tickersLoading ? (
//                   <div className="ta-ticker-dropdown-msg">Loading tickers…</div>
//                 ) : tickersError ? (
//                   <div className="ta-ticker-dropdown-msg">{tickersError}</div>
//                 ) : filteredTickers.length === 0 ? (
//                   <div className="ta-ticker-dropdown-msg">No matches found.</div>
//                 ) : (
//                   filteredTickers.map((t) => (
//                     <button
//                       type="button"
//                       key={t.idStock}
//                       className="ta-ticker-option"
//                       role="option"
//                       onClick={() => handleSelectTicker(t)}
//                     >
//                       <span className="ta-ticker-symbol">{t.stockName}</span>
//                       <span className="ta-ticker-company">{t.company}</span>
//                     </button>
//                   ))
//                 )}
//               </div>
//             )}
//           </div>
//         </div>

//         <div className="ta-ticker-field">
//           <label htmlFor="ta-company-input">Company</label>
//           <input
//             id="ta-company-input"
//             type="text"
//             className="ta-company-readonly"
//             value={selected?.company || ""}
//             readOnly
//             placeholder="Auto-filled from ticker selection"
//           />
//         </div>

//         <button type="submit" className="ta-generate-btn">
//           Generate Report
//           <Icon type="arrow" />
//         </button>
//       </form>

//       {error && (
//         <p className="ta-search-error" role="alert">
//           {error}
//         </p>
//       )}

//       <div className="ta-chips">
//         {COMMON.map((t) => (
//           <button
//             key={t}
//             className="ta-chip"
//             type="button"
//             onClick={() => handleChipClick(t)}
//             disabled={tickersLoading}
//           >
//             {t}
//           </button>
//         ))}
//       </div>

//       <p className="ta-disclaimer">
//         Not investment advice. For informational purposes only.
//       </p>

//       <style jsx>{`
//         .ta-ticker-form {
//           display: flex;
//           flex-direction: column;
//           gap: 14px;
//           width: 100%;
//           max-width: 480px;
//           margin: 0 auto;
//         }
//         .ta-ticker-field {
//           display: flex;
//           flex-direction: column;
//           gap: 6px;
//           text-align: left;
//           position: relative;
//         }
//         .ta-ticker-field label {
//           font-size: 12px;
//           font-weight: 600;
//           letter-spacing: 0.4px;
//           text-transform: uppercase;
//           color: var(--muted, #8a9490);
//         }
//         .ta-ticker-combobox {
//           position: relative;
//         }
//         .ta-ticker-combobox input,
//         .ta-company-readonly {
//           width: 100%;
//           box-sizing: border-box;
//           padding: 12px 40px 12px 14px;
//           border-radius: 12px;
//           border: 1px solid var(--line, #2a3530);
//           background: var(--card-2, #12211a);
//           color: var(--ink, #e8f0eb);
//           font-size: 14px;
//           outline: none;
//           transition: border-color 0.2s ease;
//         }
//         .ta-ticker-combobox input:focus {
//           border-color: var(--blue, #4fa772);
//         }
//         .ta-company-readonly {
//           padding-right: 14px;
//           opacity: 0.8;
//           cursor: default;
//         }
//         .ta-clear-btn {
//           position: absolute;
//           top: 50%;
//           right: 8px;
//           transform: translateY(-50%);
//           width: 26px;
//           height: 26px;
//           border: none;
//           background: transparent;
//           color: var(--muted, #8a9490);
//           cursor: pointer;
//           display: inline-flex;
//           align-items: center;
//           justify-content: center;
//         }
//         .ta-clear-btn :global(svg) {
//           width: 16px;
//           height: 16px;
//           fill: none;
//           stroke: currentColor;
//           stroke-width: 2;
//         }
//         .ta-ticker-dropdown {
//           position: absolute;
//           top: calc(100% + 6px);
//           left: 0;
//           right: 0;
//           max-height: 260px;
//           overflow-y: auto;
//           background: var(--card-2, #12211a);
//           border: 1px solid var(--line, #2a3530);
//           border-radius: 12px;
//           box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35);
//           z-index: 30;
//         }
//         .ta-ticker-dropdown-msg {
//           padding: 14px;
//           font-size: 13px;
//           color: var(--muted, #8a9490);
//         }
//         .ta-ticker-option {
//           display: flex;
//           justify-content: space-between;
//           align-items: center;
//           gap: 10px;
//           width: 100%;
//           padding: 10px 14px;
//           border: none;
//           background: transparent;
//           color: var(--ink, #e8f0eb);
//           text-align: left;
//           cursor: pointer;
//           font-size: 13.5px;
//         }
//         .ta-ticker-option:hover {
//           background: var(--row-hover, #1a2a22);
//         }
//         .ta-ticker-symbol {
//           font-weight: 700;
//           flex-shrink: 0;
//         }
//         .ta-ticker-company {
//           color: var(--muted, #8a9490);
//           overflow: hidden;
//           text-overflow: ellipsis;
//           white-space: nowrap;
//           margin-left: 12px;
//         }
//         .ta-generate-btn {
//           display: inline-flex;
//           align-items: center;
//           justify-content: center;
//           gap: 8px;
//           padding: 13px 22px;
//           border-radius: 999px;
//           border: none;
//           background: var(--blue, #4fa772);
//           color: #fff;
//           font-weight: 700;
//           font-size: 14.5px;
//           cursor: pointer;
//           transition:
//             transform 0.15s ease,
//             background 0.2s ease;
//         }
//         .ta-generate-btn:hover {
//           transform: translateY(-1px);
//         }
//         .ta-generate-btn :global(svg) {
//           width: 17px;
//           height: 17px;
//           fill: none;
//           stroke: currentColor;
//           stroke-width: 2.2;
//         }
//       `}</style>
//     </div>
//   );
// }

// // ─── GENERATING VIEW ─────────────────────────────────────────────────────────
// const GENERATING_MESSAGES = [
//   "Reviewing filings…",
//   "Synthesizing financials…",
//   "Cross-checking recent developments…",
//   "Drafting the recommendation…",
//   "Finalizing the report…",
// ];

// function GeneratingView({
//   ticker,
//   company,
// }: {
//   ticker: string;
//   company: string;
// }) {
//   const { elapsed, fmt: timerFmt } = useTimer(true);
//   const [msgIdx, setMsgIdx] = useState(0);

//   useEffect(() => {
//     const t = setInterval(
//       () => setMsgIdx((i) => (i + 1) % GENERATING_MESSAGES.length),
//       2500,
//     );
//     return () => clearInterval(t);
//   }, []);

//   return (
//     <div className="ta-root ta-loading-shell">
//       <div className="ta-loading-card">
//         <div className="ta-loading-top">
//           <span className="ta-spinning">↻</span>
//           <span className="ta-loading-headline">Generating your report…</span>
//         </div>
//         <p className="ta-loading-sub">
//           Building the equity research report for <span>{ticker}</span>
//           {company ? ` — ${company}` : ""}
//         </p>
//         <p className="ta-loading-sub" style={{ opacity: 0.75 }}>
//           {GENERATING_MESSAGES[msgIdx]}
//         </p>
//         <div className="ta-loading-top" style={{ marginTop: 18 }}>
//           <span>{timerFmt}</span>
//         </div>
//         {elapsed > 20 && (
//           <p className="ta-loading-sub" style={{ opacity: 0.6, fontSize: 12 }}>
//             This can take up to a minute or two.
//           </p>
//         )}
//       </div>
//     </div>
//   );
// }

// // ─── REPORT READY VIEW ───────────────────────────────────────────────────────
// function ReportReadyView({
//   ticker,
//   company,
//   onDownload,
//   onReset,
// }: {
//   ticker: string;
//   company: string;
//   onDownload: () => void;
//   onReset: () => void;
// }) {
//   return (
//     <div className="ta-root ta-loading-shell">
//       <div className="ta-loading-card ta-ready-card">
//         <div className="ta-ready-icon">
//           <Icon type="check" />
//         </div>
//         <span className="ta-loading-headline">Your report is ready</span>
//         <p className="ta-loading-sub">
//           <span>{ticker}</span>
//           {company ? ` — ${company}` : ""}
//         </p>
//         <div className="ta-ready-actions">
//           <button type="button" className="ta-generate-btn" onClick={onDownload}>
//             <Icon type="doc" />
//             Download PDF
//           </button>
//           <button type="button" className="ta-secondary-btn" onClick={onReset}>
//             Run Another Analysis
//           </button>
//         </div>
//       </div>
//       <style jsx>{`
//         .ta-ready-icon {
//           width: 52px;
//           height: 52px;
//           border-radius: 50%;
//           background: rgba(79, 167, 114, 0.16);
//           color: var(--blue, #4fa772);
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           margin: 0 auto 14px;
//         }
//         .ta-ready-icon :global(svg) {
//           width: 26px;
//           height: 26px;
//           fill: none;
//           stroke: currentColor;
//           stroke-width: 2.5;
//         }
//         .ta-ready-actions {
//           display: flex;
//           flex-direction: column;
//           gap: 10px;
//           margin-top: 22px;
//           align-items: center;
//         }
//         .ta-secondary-btn {
//           background: transparent;
//           border: none;
//           color: var(--muted, #8a9490);
//           font-size: 13px;
//           cursor: pointer;
//           text-decoration: underline;
//         }
//         .ta-secondary-btn:hover {
//           color: var(--ink, #e8f0eb);
//         }
//       `}</style>
//     </div>
//   );
// }

// // ─── ERROR VIEW ──────────────────────────────────────────────────────────────
// function ErrorView({
//   message,
//   onRetry,
// }: {
//   message: string;
//   onRetry: () => void;
// }) {
//   return (
//     <div className="ta-root ta-loading-shell">
//       <div className="ta-loading-card">
//         <span className="ta-loading-headline">Something went wrong</span>
//         <p className="ta-loading-sub">{message}</p>
//         <button
//           type="button"
//           className="ta-generate-btn"
//           style={{ marginTop: 18 }}
//           onClick={onRetry}
//         >
//           Try Again
//         </button>
//       </div>
//     </div>
//   );
// }

// // ─── PDF HELPERS ─────────────────────────────────────────────────────────────
// type RGB = [number, number, number];

// // Strip AI search-citation markers (e.g. "citeturn5view2", "citeturn2view2turn8view3")
// // that appear inside the webhook's text fields — they'd render as garbage in the PDF.
// function clean(text?: string): string {
//   return (text || "")
//     .replace(/cite(?:turn\d+(?:view|search|news|forecast)\d+)+/gi, "")
//     .replace(/turn\d+(?:view|search|news|forecast)\d+/gi, "")
//     .replace(/[ \t]{2,}/g, " ")
//     .replace(/\s+([.,;:)])/g, "$1")
//     .trim();
// }

// // Nice, report-style labels for the flat key_metrics object.
// const METRIC_LABELS: Record<string, string> = {
//   enterprise_value: "Enterprise Value",
//   market_cap: "Market Cap",
//   revenue_fwd_ttm: "Revenue Fwd (TTM)",
//   ytd_return: "YTD Return",
//   fwd_ttm_pe: "Fwd (TTM) P/E",
//   rsi: "RSI",
//   ebitda_margin_ttm: "EBITDA Margin (TTM)",
//   revenue_growth_ttm_yoy: "Revenue Growth (TTM, YoY)",
//   roic_ttm: "ROIC (TTM)",
//   cfo_3y_cagr: "CFO 3Y CAGR",
//   fcf_3y_cagr: "FCF 3Y CAGR",
//   revenue_3y_cagr: "Revenue 3Y CAGR",
//   week_52_high: "52-Week High",
//   week_52_low: "52-Week Low",
//   moving_avg_200d: "200-Day Moving Avg",
//   ebitda_ttm: "EBITDA (TTM)",
//   cfo_ttm: "CFO (TTM)",
//   fcf_ttm: "FCF (TTM)",
// };

// const METRIC_ACRONYMS = new Set([
//   "pe", "ttm", "roic", "cfo", "fcf", "rsi", "ytd", "ebitda", "cagr", "yoy", "ev", "usd",
// ]);
// function formatMetricLabel(key: string): string {
//   if (METRIC_LABELS[key]) return METRIC_LABELS[key];
//   return key
//     .split("_")
//     .map((w) =>
//       METRIC_ACRONYMS.has(w.toLowerCase())
//         ? w.toUpperCase()
//         : w.charAt(0).toUpperCase() + w.slice(1),
//     )
//     .join(" ");
// }

// // Best-effort logo load → dataURL (needs CORS-clean image); returns null on failure.
// async function loadLogoDataUrl(url: string): Promise<string | null> {
//   try {
//     const img = new Image();
//     img.crossOrigin = "anonymous";
//     await new Promise<void>((resolve, reject) => {
//       img.onload = () => resolve();
//       img.onerror = () => reject(new Error("logo load failed"));
//       img.src = url;
//     });
//     const canvas = document.createElement("canvas");
//     canvas.width = img.naturalWidth || 120;
//     canvas.height = img.naturalHeight || 120;
//     const ctx = canvas.getContext("2d");
//     if (!ctx) return null;
//     ctx.drawImage(img, 0, 0);
//     return canvas.toDataURL("image/png");
//   } catch {
//     return null;
//   }
// }

// // ─── PDF GENERATION ──────────────────────────────────────────────────────────
// async function generateAnalysisPdf(
//   report: AnalysisReport,
//   selection: TickerSelection,
// ) {
//   const doc = new jsPDF({ unit: "pt", format: "letter" });
//   const pageWidth = doc.internal.pageSize.getWidth();
//   const pageHeight = doc.internal.pageSize.getHeight();

//   const margin = 44;
//   const headerH = 46;
//   const contentTop = margin + headerH + 6;
//   const contentWidth = pageWidth - margin * 2;
//   const bottomLimit = pageHeight - 42;
//   let y = contentTop;

//   const ink: RGB = [26, 32, 28];
//   const muted: RGB = [110, 116, 108];
//   const green: RGB = [31, 91, 57];
//   const greenMid: RGB = [74, 140, 90];
//   const border: RGB = [214, 226, 218];
//   const yellowBg: RGB = [253, 246, 214];
//   const yellowBorder: RGB = [214, 178, 43];

//   const logo = await loadLogoDataUrl(JARVIS_LOGO_URL);

//   const p1 = report.page_1 || {};
//   const headerTicker = p1.ticker || selection.ticker || "";
//   const headerDate = (() => {
//     const d = new Date(p1.report_date || "");
//     if (!isNaN(d.getTime())) {
//       return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
//     }
//     return p1.report_date || "";
//   })();

//   const ensureSpace = (needed: number) => {
//     if (y + needed > bottomLimit) {
//       doc.addPage();
//       y = contentTop;
//     }
//   };
//   const newSection = () => {
//     doc.addPage();
//     y = contentTop;
//   };

//   const heading = (text: string, size = 15) => {
//     ensureSpace(size + 12);
//     doc.setFont("helvetica", "bold");
//     doc.setFontSize(size);
//     doc.setTextColor(...green);
//     doc.text(text, margin, y);
//     y += size + 8;
//   };
//   const subheading = (text: string, size = 11.5) => {
//     if (!text) return;
//     ensureSpace(size + 8);
//     doc.setFont("helvetica", "bold");
//     doc.setFontSize(size);
//     doc.setTextColor(...ink);
//     doc.text(text, margin, y);
//     y += size + 5;
//   };
//   const paragraph = (text?: string, size = 9.5, italic = false) => {
//     const t = clean(text);
//     if (!t) return;
//     doc.setFont("helvetica", italic ? "italic" : "normal");
//     doc.setFontSize(size);
//     doc.setTextColor(...ink);
//     const lines = doc.splitTextToSize(t, contentWidth) as string[];
//     lines.forEach((line) => {
//       ensureSpace(size * 1.42);
//       doc.text(line, margin, y);
//       y += size * 1.42;
//     });
//     y += 6;
//   };
//   const label = (text: string, size = 8.5) => {
//     ensureSpace(size + 4);
//     doc.setFont("helvetica", "bold");
//     doc.setFontSize(size);
//     doc.setTextColor(...muted);
//     doc.text(text.toUpperCase(), margin, y);
//     y += size + 4;
//   };
//   const divider = () => {
//     ensureSpace(14);
//     doc.setDrawColor(...border);
//     doc.setLineWidth(0.75);
//     doc.line(margin, y, pageWidth - margin, y);
//     y += 14;
//   };

//   // ── chart drawers ──────────────────────────────────────────────────────────
//   const PIE_COLORS: RGB[] = [
//     [46, 109, 89], [74, 140, 90], [120, 175, 105],
//     [165, 205, 150], [205, 225, 195], [90, 130, 110], [40, 90, 70],
//   ];

//   const drawPieChart = (chart?: ChartData) => {
//     if (!chart) return;
//     const labels = chart.labels || [];
//     const values = chart.values_usd_b || chart.values || [];
//     if (!labels.length || !values.length) return;
//     const total = values.reduce((a, b) => a + (Number(b) || 0), 0);
//     if (total <= 0) return;

//     const blockH = 190;
//     ensureSpace(blockH + 30);
//     divider();
//     subheading(clean(chart.title) || "Chart");

//     const cx = margin + 78;
//     const cy = y + 78;
//     const r = 70;
//     let a0 = -Math.PI / 2;
//     const isB = !!chart.values_usd_b;
//     const fmtVal = (v: number) =>
//       isB ? `$${v.toFixed(2)}B` : `$${Math.round(v).toLocaleString("en-US")}`;

//     values.forEach((raw, i) => {
//       const v = Number(raw) || 0;
//       const frac = v / total;
//       const a1 = a0 + frac * Math.PI * 2;
//       const col = PIE_COLORS[i % PIE_COLORS.length];
//       doc.setFillColor(...col);
//       const step = Math.max(0.05, (a1 - a0) / 24);
//       for (let a = a0; a < a1 - 1e-6; a += step) {
//         const b = Math.min(a + step, a1);
//         doc.triangle(
//           cx, cy,
//           cx + r * Math.cos(a), cy + r * Math.sin(a),
//           cx + r * Math.cos(b), cy + r * Math.sin(b),
//           "F",
//         );
//       }
//       a0 = a1;
//     });

//     // legend
//     let ly = y + 14;
//     const lx = cx + r + 26;
//     labels.forEach((lab, i) => {
//       const v = Number(values[i]) || 0;
//       const col = PIE_COLORS[i % PIE_COLORS.length];
//       doc.setFillColor(...col);
//       doc.rect(lx, ly - 7, 9, 9, "F");
//       doc.setFont("helvetica", "normal");
//       doc.setFontSize(9);
//       doc.setTextColor(...ink);
//       const pctTxt = `${((v / total) * 100).toFixed(1)}%`;
//       const text = `${clean(lab)} — ${fmtVal(v)} (${pctTxt})`;
//       const wrapped = doc.splitTextToSize(text, contentWidth - (lx - margin) - 4) as string[];
//       wrapped.forEach((wln, k) => {
//         doc.text(wln, lx + 15, ly + k * 12);
//       });
//       ly += Math.max(16, wrapped.length * 12 + 4);
//     });

//     y = Math.max(cy + r + 14, ly) + 6;
//     if (chart.source) paragraph(clean(chart.source), 8);
//   };

//   const drawBarChart = (chart?: ChartData) => {
//     if (!chart) return;
//     const labels = chart.labels || [];
//     const values = (chart.values_usd_b || chart.values || []).map((v) => Number(v) || 0);
//     if (!labels.length || !values.length) return;

//     const chartH = 150;
//     ensureSpace(chartH + 60);
//     divider();
//     subheading(clean(chart.title) || "Chart");

//     const plotX = margin + 6;
//     const plotY = y;
//     const plotW = contentWidth - 12;
//     const plotH = chartH;
//     const baseY = plotY + plotH;
//     const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1);
//     const isB = !!chart.values_usd_b;
//     const anyNeg = values.some((v) => v < 0);

//     const fmtBar = (v: number) => {
//       if (isB) return `$${v.toFixed(1)}B`;
//       const s = "$" + Math.abs(v).toLocaleString("en-US");
//       return v < 0 ? `(${s})` : s;
//     };

//     // baseline
//     doc.setDrawColor(...border);
//     doc.setLineWidth(0.75);
//     doc.line(plotX, baseY, plotX + plotW, baseY);

//     const n = values.length;
//     const slot = plotW / n;
//     const bw = Math.min(48, slot * 0.55);
//     values.forEach((v, i) => {
//       const h = (Math.abs(v) / maxAbs) * (plotH - 22);
//       const bx = plotX + i * slot + (slot - bw) / 2;
//       const by = baseY - h;
//       doc.setFillColor(...greenMid);
//       doc.rect(bx, by, bw, h, "F");
//       // value label
//       doc.setFont("helvetica", "bold");
//       doc.setFontSize(7.5);
//       doc.setTextColor(...ink);
//       doc.text(fmtBar(v), bx + bw / 2, by - 4, { align: "center" });
//       // x label
//       doc.setFont("helvetica", "normal");
//       doc.setFontSize(7.5);
//       doc.setTextColor(...muted);
//       doc.text(clean(labels[i] || ""), bx + bw / 2, baseY + 12, { align: "center" });
//     });

//     y = baseY + 24;
//     if (anyNeg) {
//       // note nothing extra; parens already convey sign
//     }
//     if (chart.source) paragraph(clean(chart.source), 8);
//   };

//   // ── PAGE 1: COVER / FRESH LOOK ──────────────────────────────────────────────
//   // Company name + ticker (centered)
//   doc.setFont("helvetica", "bold");
//   doc.setFontSize(22);
//   doc.setTextColor(...green);
//   const nameLines = doc.splitTextToSize(
//     (p1.company_name || selection.company || "").toUpperCase(),
//     contentWidth - 40,
//   ) as string[];
//   nameLines.forEach((ln) => {
//     doc.text(ln, pageWidth / 2, y, { align: "center" });
//     y += 24;
//   });
//   doc.setFont("helvetica", "normal");
//   doc.setFontSize(12);
//   doc.setTextColor(...muted);
//   doc.text(`(Ticker: ${p1.ticker || selection.ticker || "—"})`, pageWidth / 2, y, {
//     align: "center",
//   });
//   y += 22;

//   // Traffic-light gauge
//   {
//     const rating = (p1.rating || "").toUpperCase();
//     const active = rating.includes("GREEN")
//       ? 0
//       : rating.includes("YELLOW")
//       ? 1
//       : rating.includes("RED")
//       ? 2
//       : -1;
//     const lights: [string, RGB][] = [
//       ["GREEN", [58, 166, 85]],
//       ["YELLOW", [241, 181, 58]],
//       ["RED", [224, 71, 58]],
//     ];
//     doc.setFont("helvetica", "bold");
//     doc.setFontSize(8);
//     doc.setTextColor(...muted);
//     doc.text("LBWM RECOMMENDATION", pageWidth / 2, y, { align: "center" });
//     y += 12;
//     const gap = 58;
//     const startX = pageWidth / 2 - gap;
//     lights.forEach(([lab, col], i) => {
//       const cx = startX + i * gap;
//       const on = i === active;
//       if (on) {
//         doc.setFillColor(...col);
//       } else {
//         doc.setFillColor(224, 228, 224);
//       }
//       doc.circle(cx, y + 8, 8, "F");
//       if (on) {
//         doc.setDrawColor(...col);
//         doc.setLineWidth(1.4);
//         doc.circle(cx, y + 8, 11, "S");
//       }
//       doc.setFont("helvetica", on ? "bold" : "normal");
//       doc.setFontSize(7.5);
//       doc.setTextColor(...(on ? col : muted));
//       doc.text(lab, cx, y + 26, { align: "center" });
//     });
//     y += 40;
//   }

//   // Green info grid (2 rows × 3 cols)
//   {
//     const cells: [string, string][] = [
//       ["Stock Price", clean(`${p1.stock_price || "—"}${p1.stock_price_date ? ` (${p1.stock_price_date})` : ""}`)],
//       ["Company Size", clean(p1.company_size || "—")],
//       ["Author", clean(p1.author || REPORT_AUTHOR)],
//       ["Company Rank", clean(p1.company_rank || "—")],
//       ["Sector", clean(p1.sector || "—")],
//       ["Industry", clean(p1.industry || "—")],
//     ];
//     const cw = contentWidth / 3;
//     const ch = 40;
//     const gy = y;
//     cells.forEach((c, i) => {
//       const col = i % 3;
//       const row = Math.floor(i / 3);
//       const cx = margin + col * cw;
//       const cyy = gy + row * ch;
//       doc.setFillColor(...green);
//       doc.rect(cx + 1.5, cyy + 1.5, cw - 3, ch - 3, "F");
//       doc.setFont("helvetica", "bold");
//       doc.setFontSize(7);
//       doc.setTextColor(210, 230, 216);
//       doc.text(c[0].toUpperCase(), cx + 8, cyy + 14);
//       doc.setFont("helvetica", "bold");
//       doc.setFontSize(9);
//       doc.setTextColor(255, 255, 255);
//       const v = (doc.splitTextToSize(c[1], cw - 16) as string[])[0] || "—";
//       doc.text(v, cx + 8, cyy + 28);
//     });
//     y = gy + ch * 2 + 14;
//   }

//   // Tagline
//   paragraph(p1.tagline, 10, true);
//   divider();

//   // "IN THIS FRESH LOOK WE'LL COVER" — two columns
//   doc.setFont("helvetica", "bold");
//   doc.setFontSize(13);
//   doc.setTextColor(...green);
//   doc.text("IN THIS FRESH LOOK WE'LL COVER:", pageWidth / 2, y, { align: "center" });
//   y += 18;

//   {
//     const gapCol = 20;
//     const leftW = (contentWidth - gapCol) * 0.56;
//     const rightW = contentWidth - gapCol - leftW;
//     const lx = margin;
//     const rx = margin + leftW + gapCol;
//     const topY = y;

//     const writeCol = (
//       text: string,
//       x: number,
//       startY: number,
//       w: number,
//       size: number,
//       color: RGB,
//       style: "normal" | "bold" | "italic",
//       gap = 1.4,
//     ) => {
//       doc.setFont("helvetica", style);
//       doc.setFontSize(size);
//       doc.setTextColor(...color);
//       const lines = doc.splitTextToSize(clean(text), w) as string[];
//       let yy = startY;
//       lines.forEach((l) => {
//         doc.text(l, x, yy);
//         yy += size * gap;
//       });
//       return yy;
//     };

//     // left column: the four sections
//     let yL = topY;
//     const fresh = p1.in_this_fresh_look || {};
//     const sections: [string, string | undefined][] = [
//       ["Summary of the Business", fresh.summary_of_business],
//       ["Recent Developments", fresh.recent_developments],
//       ["Competitive Environment", fresh.competitive_environment],
//       ["Conclusions / Recommendations", fresh.conclusions_recommendations],
//     ];
//     sections.forEach(([title, body]) => {
//       if (!body) return;
//       yL = writeCol(title, lx, yL, leftW, 9.5, green, "bold");
//       yL += 2;
//       yL = writeCol(body, lx, yL, leftW, 8.8, ink, "normal");
//       yL += 8;
//     });

//     // right column: Grab-and-Go Thesis box
//     let yR = topY;
//     const thesis = clean(p1.grab_and_go_thesis);
//     if (thesis) {
//       const pad = 12;
//       doc.setFont("helvetica", "italic");
//       doc.setFontSize(8.8);
//       const bodyLines = doc.splitTextToSize(thesis, rightW - pad * 2) as string[];
//       const titleH = 18;
//       const boxH = pad * 2 + titleH + bodyLines.length * 8.8 * 1.4;
//       doc.setFillColor(...yellowBg);
//       doc.setDrawColor(...yellowBorder);
//       doc.setLineWidth(1);
//       doc.roundedRect(rx, topY, rightW, boxH, 6, 6, "FD");
//       doc.setFont("helvetica", "bold");
//       doc.setFontSize(12);
//       doc.setTextColor(...green);
//       doc.text("Grab-and-Go Thesis", rx + pad, topY + pad + 8);
//       doc.setFont("helvetica", "italic");
//       doc.setFontSize(8.8);
//       doc.setTextColor(58, 58, 50);
//       let ty = topY + pad + titleH + 6;
//       bodyLines.forEach((l) => {
//         doc.text(l, rx + pad, ty);
//         ty += 8.8 * 1.4;
//       });
//       yR = topY + boxH;
//     }

//     y = Math.max(yL, yR) + 6;
//   }

//   // ── PAGE 2: KEY METRICS ─────────────────────────────────────────────────────
//   const p2 = report.page_2;
//   if (p2) {
//     newSection();
//     heading("Key Metrics", 16);
//     if (p2.data_as_of) paragraph(`Data as of: ${p2.data_as_of}`, 8.5);

//     if (p2.key_metrics) {
//       const entries = Object.entries(p2.key_metrics);
//       const rows: string[][] = [];
//       for (let i = 0; i < entries.length; i += 3) {
//         const chunk = entries.slice(i, i + 3);
//         const row: string[] = [];
//         for (let k = 0; k < 3; k++) {
//           if (chunk[k]) {
//             row.push(formatMetricLabel(chunk[k][0]));
//             row.push(clean(chunk[k][1] ?? "N/A") || "N/A");
//           } else {
//             row.push("", "");
//           }
//         }
//         rows.push(row);
//       }
//       ensureSpace(120);
//       autoTable(doc, {
//         startY: y,
//         body: rows,
//         theme: "grid",
//         styles: { fontSize: 8.2, cellPadding: 5, lineColor: border, lineWidth: 0.5 },
//         columnStyles: {
//           0: { fillColor: green, textColor: 255, fontStyle: "bold", cellWidth: 78 },
//           2: { fillColor: green, textColor: 255, fontStyle: "bold", cellWidth: 78 },
//           4: { fillColor: green, textColor: 255, fontStyle: "bold", cellWidth: 78 },
//           1: { fillColor: [240, 246, 242], textColor: ink, fontStyle: "bold" },
//           3: { fillColor: [240, 246, 242], textColor: ink, fontStyle: "bold" },
//           5: { fillColor: [240, 246, 242], textColor: ink, fontStyle: "bold" },
//         },
//         margin: { left: margin, right: margin },
//       });
//       y = (doc as any).lastAutoTable.finalY + 16;
//     }

//     if (p2.insider_transactions) {
//       const txt = clean(p2.insider_transactions);
//       doc.setFont("helvetica", "bold");
//       doc.setFontSize(9);
//       const lines = doc.splitTextToSize(`Insider Transactions: ${txt}`, contentWidth - 20) as string[];
//       const boxH = lines.length * 9 * 1.4 + 14;
//       ensureSpace(boxH + 8);
//       doc.setFillColor(...yellowBg);
//       doc.setDrawColor(...yellowBorder);
//       doc.setLineWidth(1);
//       doc.roundedRect(margin, y, contentWidth, boxH, 4, 4, "FD");
//       doc.setTextColor(120, 90, 0);
//       let ty = y + 14;
//       lines.forEach((l) => {
//         doc.text(l, margin + 10, ty);
//         ty += 9 * 1.4;
//       });
//       y += boxH + 14;
//     }

//     if (p2.summary_of_business?.length) {
//       heading("Summary of Business", 14);
//       p2.summary_of_business.forEach((para) => paragraph(`•  ${clean(para)}`));
//     }

//     if (p2.annual_report_url) {
//       subheading("Annual Report");
//       ensureSpace(16);
//       doc.setTextColor(...green);
//       doc.setFont("helvetica", "bold");
//       doc.setFontSize(9);
//       doc.textWithLink("View filing →", margin, y, { url: p2.annual_report_url });
//       y += 18;
//     }

//     drawPieChart(p2.revenue_pie_chart);
//   }

//   // ── PAGE 3: PRODUCT & SERVICE PORTFOLIO ─────────────────────────────────────
//   const p3 = report.page_3;
//   if (p3) {
//     newSection();
//     heading("Product & Service Portfolio", 16);
//     const portfolio = p3.product_and_service_portfolio;
//     if (portfolio?.intro) paragraph(portfolio.intro);
//     portfolio?.products?.forEach((prod) => {
//       subheading(clean(prod.name || ""));
//       paragraph(prod.description);
//     });
//     drawBarChart(p3.key_segment_chart);
//   }

//   // ── PAGE 4: STRATEGIC THEMES ────────────────────────────────────────────────
//   const p4 = report.page_4;
//   if (p4) {
//     newSection();
//     heading("Strategic Themes", 16);
//     p4.strategic_themes?.forEach((theme) => {
//       subheading(clean(theme.title || ""));
//       theme.paragraphs?.forEach((para) => paragraph(para));
//     });
//     drawBarChart(p4.capex_chart);
//   }

//   // ── SOURCES ─────────────────────────────────────────────────────────────────
//   if (report.sources?.length) {
//     newSection();
//     heading("Sources", 16);
//     report.sources.forEach((src, i) => paragraph(`${i + 1}. ${clean(src)}`, 8.5));
//   }

//   // ── HEADER + FOOTER on every page ───────────────────────────────────────────
//   const pageCount = doc.getNumberOfPages();
//   for (let i = 1; i <= pageCount; i++) {
//     doc.setPage(i);

//     // header band
//     doc.setFillColor(238, 241, 238);
//     doc.rect(0, 0, pageWidth, headerH, "F");
//     let bx = margin;
//     if (logo) {
//       try {
//         doc.addImage(logo, "PNG", margin, 9, 26, 26);
//         bx = margin + 34;
//       } catch {
//         bx = margin;
//       }
//     }
//     doc.setFont("helvetica", "bold");
//     doc.setFontSize(13);
//     doc.setTextColor(...green);
//     doc.text("JARVIS", bx, 22);
//     doc.setFont("helvetica", "normal");
//     doc.setFontSize(8);
//     doc.setTextColor(...muted);
//     doc.text("FRESH LOOK", bx, 33);

//     doc.setFont("helvetica", "bold");
//     doc.setFontSize(12);
//     doc.setTextColor(...green);
//     doc.text(
//       `STOCK: ${headerTicker}${headerDate ? `  |  ${headerDate}` : ""}`,
//       pageWidth - margin,
//       26,
//       { align: "right" },
//     );
//     doc.setDrawColor(...border);
//     doc.setLineWidth(0.75);
//     doc.line(margin, headerH, pageWidth - margin, headerH);

//     // footer
//     doc.setFont("helvetica", "normal");
//     doc.setFontSize(8);
//     doc.setTextColor(...muted);
//     doc.text(clean(p1.author || REPORT_AUTHOR), margin, pageHeight - 22);
//     doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 22, {
//       align: "right",
//     });
//   }

//   const safeTicker = (selection.ticker || "report").replace(/[^a-z0-9]/gi, "_");
//   doc.save(
//     `${safeTicker}_FreshLook_${new Date().toISOString().split("T")[0]}.pdf`,
//   );
// }

// // ─── PAGE ROOT ───────────────────────────────────────────────────────────────
// type ViewState = "home" | "generating" | "ready" | "error";

// export default function StockAnalysisPage() {
//   const [view, setView] = useState<ViewState>("home");
//   const [selection, setSelection] = useState<TickerSelection | null>(null);
//   const [reportData, setReportData] = useState<AnalysisReport | null>(null);
//   const [errorMsg, setErrorMsg] = useState("");

//   const handleSearch = async (sel: TickerSelection) => {
//     setSelection(sel);
//     setErrorMsg("");
//     setView("generating");
//     try {
//       const res = await fetch(REPORT_WEBHOOK_URL, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           companyName: sel.company,
//           ticker: sel.ticker,
//           author: REPORT_AUTHOR,
//         }),
//       });
//       if (!res.ok) {
//         throw new Error(`Report generation failed (${res.status}).`);
//       }
//       const json = await res.json();
//       const output: AnalysisReport | undefined = json?.output;
//       if (!output) {
//         throw new Error("The report service returned an unexpected response.");
//       }
//       setReportData(output);
//       // Auto-download immediately, then show a confirmation screen.
//       await generateAnalysisPdf(output, sel);
//       setView("ready");
//     } catch (err) {
//       setErrorMsg(
//         (err as Error).message || "Something went wrong generating the report.",
//       );
//       setView("error");
//     }
//   };

//   const handleDownload = async () => {
//     if (!reportData || !selection) return;
//     await generateAnalysisPdf(reportData, selection);
//   };

//   const handleReset = () => {
//     setSelection(null);
//     setReportData(null);
//     setErrorMsg("");
//     setView("home");
//   };

//   return (
//     <>
//       {view === "home" && <HomeView onSearch={handleSearch} />}
//       {view === "generating" && selection && (
//         <GeneratingView ticker={selection.ticker} company={selection.company} />
//       )}
//       {view === "ready" && selection && (
//         <ReportReadyView
//           ticker={selection.ticker}
//           company={selection.company}
//           onDownload={handleDownload}
//           onReset={handleReset}
//         />
//       )}
//       {view === "error" && (
//         <ErrorView message={errorMsg} onRetry={handleReset} />
//       )}
//     </>
//   );
// }
