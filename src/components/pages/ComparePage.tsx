"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { InfoTip, FORMULAS } from "@/components/InfoTip";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SCORE_WEBHOOK_URL =
  "https://n8n.srv1375926.hstgr.cloud/webhook/jarvis-score-stock";
const REQUEST_TIMEOUT_MS = 6 * 60 * 1000;
const MAX_TICKERS = 4;

// Cache of already-processed stocks (memory + localStorage) so a repeat
// comparison is instant and never repeats the API call.
const CACHE_KEY = "jarvis_compare_cache_v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 40;

type Stock = ReturnType<typeof slim>;
type CacheEntry = { data: Stock; savedAt: number };
const MEM_CACHE = new Map<string, CacheEntry>();
const IN_FLIGHT = new Map<string, Promise<Stock>>();

function readStore(): Record<string, CacheEntry> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}
function getCached(t: string): Stock | null {
  const fresh = (e?: CacheEntry | null) =>
    e && Date.now() - e.savedAt < CACHE_TTL_MS ? e : null;
  const mem = fresh(MEM_CACHE.get(t));
  if (mem) return mem.data;
  if (typeof window === "undefined") return null;
  const stored = fresh(readStore()[t]);
  if (stored) MEM_CACHE.set(t, stored);
  return stored ? stored.data : null;
}
function setCached(t: string, data: Stock) {
  const entry = { data, savedAt: Date.now() };
  MEM_CACHE.set(t, entry);
  try {
    const store = readStore();
    store[t] = entry;
    const keys = Object.keys(store);
    if (keys.length > CACHE_MAX_ENTRIES) {
      keys
        .sort((a, b) => store[a].savedAt - store[b].savedAt)
        .slice(0, keys.length - CACHE_MAX_ENTRIES)
        .forEach((k) => delete store[k]);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {
    /* storage blocked/full: memory cache still works */
  }
}

// ─── API + NORMALISER ────────────────────────────────────────────────────────
const isNum = (v: any): v is number =>
  typeof v === "number" && isFinite(v);

/** Reduce the large webhook payload to just what the comparison needs. */
function slim(r: any) {
  const raw: Record<string, number> = {};
  (r.raw_inputs || []).forEach((i: any) => {
    if (isNum(i.value)) raw[i.name] = i.value;
  });
  const p = r.profile || {};
  const engines: Record<string, any> = {};
  Object.entries(r.engines || {}).forEach(([k, e]: [string, any]) => {
    engines[k] = {
      score: e.score,
      trend: e.trend,
      change: e.score_change,
      conf: e.confidence,
    };
  });
  const factors: Record<string, any> = {};
  Object.entries(r.factors || {}).forEach(([k, f]: [string, any]) => {
    factors[k] = {
      name: f.display_name || f.factor_name,
      score: f.score_0_100,
      trend: f.trend,
      change: f.score_change,
    };
  });
  const mcap = isNum(p.market_cap) ? p.market_cap : raw.market_cap;
  return {
    t: String(r.ticker || p.ticker || "").toUpperCase(),
    name: p.name || r.ticker,
    sector: p.sector,
    industry: p.industry,
    price: p.price,
    mcap,
    score: r.jarvis_score as number,
    conf: r.jarvis_confidence as string,
    trend: r.trend as string,
    change: r.score_change as number,
    risk: r.position_risk?.score as number,
    riskLabel: r.position_risk?.label as string,
    engines,
    factors,
    catalysts: (r.key_catalysts || []) as string[],
    risks: (r.main_risks || []) as string[],
    take: r.jarvis_take as string,
    m: {
      revGrowth: raw.revenue_yoy_growth_latest_q,
      revAccel: raw.revenue_acceleration,
      opGrowth: raw.operating_income_growth_ttm,
      epsGrowth: raw.eps_growth_ttm,
      opMargin: raw.operating_margin_ttm,
      opMarginChg: raw.operating_margin_change_yoy,
      fcfMargin: raw.fcf_margin,
      roic: raw.roic_ttm,
      fcfYield: raw.fcf_yield,
      pe:
        isNum(mcap) && raw.net_income_ttm > 0 ? mcap / raw.net_income_ttm : null,
      pfcf: isNum(mcap) && raw.fcf_ttm > 0 ? mcap / raw.fcf_ttm : null,
      peVsMedian: raw.pe_vs_3y_median,
      fwdPe: raw.forward_pe,
      targetUpside: raw.analyst_target_upside,
      netDebt: raw.net_debt_to_ebitda,
      shareChg: raw.share_count_change_yoy,
      rs6: raw.relative_strength_6m,
      rs12: raw.relative_strength_12m,
      vs200: raw.price_vs_200dma,
      vol: raw.volatility_annualised,
      beta: raw.beta,
    } as Record<string, number | null | undefined>,
  };
}

async function fetchScore(ticker: string): Promise<Stock> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(SCORE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker }),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      /* handled below */
    }
    if (!res.ok) {
      const msg = (data && (data.message || data.error)) || text;
      throw new Error(
        typeof msg === "string" && msg
          ? msg.slice(0, 200)
          : `Request failed (HTTP ${res.status})`,
      );
    }
    const r = Array.isArray(data) ? data[0] : data;
    if (!r || r.jarvis_score === undefined) {
      throw new Error(r?.message || "Incomplete response from the scoring service.");
    }
    return slim(r);
  } catch (e: any) {
    if (e.name === "AbortError") throw new Error("Timed out. Try again shortly.");
    if (e instanceof TypeError) throw new Error("Could not reach the scoring service.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Cache first, then de-duplicated network call. */
function loadStock(ticker: string): Promise<Stock> {
  const hit = getCached(ticker);
  if (hit) return Promise.resolve(hit);
  let p = IN_FLIGHT.get(ticker);
  if (!p) {
    p = fetchScore(ticker)
      .then((s) => {
        setCached(ticker, s);
        return s;
      })
      .finally(() => IN_FLIGHT.delete(ticker));
    IN_FLIGHT.set(ticker, p);
  }
  return p;
}

// ─── FORMATTING ──────────────────────────────────────────────────────────────
const f1 = (v: any) => (isNum(v) ? v.toFixed(1) : "—");
const pct = (v: any) => (isNum(v) ? `${v.toFixed(1)}%` : "—");
const sgnPct = (v: any) =>
  isNum(v) ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%` : "—";
const sgnPp = (v: any) =>
  isNum(v) ? `${v > 0 ? "+" : ""}${v.toFixed(1)} pp` : "—";
const mult = (v: any) => (isNum(v) ? `${v.toFixed(1)}x` : "—");
const usd = (v: any) => (isNum(v) ? `$${v.toFixed(2)}` : "—");
const bigUsd = (v: any) => {
  if (!isNum(v)) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  return `$${(v / 1e6).toFixed(0)}M`;
};
const sgn = (v: any) =>
  isNum(v) ? `${v > 0 ? "+" : ""}${v.toFixed(1)}` : "—";

const scoreColor = (v: any) =>
  !isNum(v) ? "var(--muted)" : v >= 70 ? "var(--green)" : v >= 45 ? "var(--amber)" : "var(--red)";
const trendColor = (t?: string) =>
  t === "Improving" ? "var(--green)" : t === "Deteriorating" ? "var(--red)" : "var(--muted)";
const trendIcon = (t?: string) =>
  t === "Improving" ? "▲" : t === "Deteriorating" ? "▼" : "●";

// ─── TABLE DEFINITION ────────────────────────────────────────────────────────
type Row = {
  label: string;
  get: (s: Stock) => number | null | undefined;
  fmt: (v: any) => string;
  best?: "hi" | "lo"; // which direction wins (omit = no highlight)
  tip?: string;
  score?: boolean; // colour as a 0-100 score
};
type Section = { title: string; rows: Row[] };

const factorRow = (id: string, label: string): Row => ({
  label,
  get: (s) => s.factors[id]?.score,
  fmt: f1,
  best: "hi",
  score: true,
});
const engineRow = (id: string, label: string, tip?: string): Row => ({
  label,
  get: (s) => s.engines[id]?.score,
  fmt: f1,
  best: "hi",
  score: true,
  tip,
});

const SECTIONS: Section[] = [
  {
    title: "Overall",
    rows: [
      { label: "Jarvis Score", get: (s) => s.score, fmt: f1, best: "hi", score: true, tip: FORMULAS.composite },
      { label: "Score Change", get: (s) => s.change, fmt: sgn, best: "hi" },
      { label: "Position Risk (higher = safer)", get: (s) => s.risk, fmt: f1, best: "hi", score: true },
    ],
  },
  {
    title: "Engines",
    rows: [
      engineRow("growth", "Growth"),
      engineRow("quality", "Business Quality"),
      engineRow("momentum", "Momentum"),
      engineRow("valuation", "Valuation"),
    ],
  },
  {
    title: "Growth & Profitability",
    rows: [
      { label: "Revenue Growth (YoY, latest Q)", get: (s) => s.m.revGrowth, fmt: sgnPct, best: "hi" },
      { label: "Revenue Acceleration", get: (s) => s.m.revAccel, fmt: sgnPp, best: "hi" },
      { label: "Operating Income Growth (TTM)", get: (s) => s.m.opGrowth, fmt: sgnPct, best: "hi" },
      { label: "EPS Growth (TTM)", get: (s) => s.m.epsGrowth, fmt: sgnPct, best: "hi" },
      { label: "Operating Margin (TTM)", get: (s) => s.m.opMargin, fmt: pct, best: "hi" },
      { label: "Operating Margin Change (YoY)", get: (s) => s.m.opMarginChg, fmt: sgnPp, best: "hi" },
      { label: "FCF Margin (TTM)", get: (s) => s.m.fcfMargin, fmt: pct, best: "hi" },
      { label: "ROIC", get: (s) => s.m.roic, fmt: pct, best: "hi", tip: FORMULAS.roic },
    ],
  },
  {
    title: "Valuation",
    rows: [
      { label: "Trailing P / E", get: (s) => s.m.pe, fmt: mult, best: "lo", tip: FORMULAS.pe },
      { label: "Forward P / E", get: (s) => s.m.fwdPe, fmt: mult, best: "lo" },
      { label: "P / FCF", get: (s) => s.m.pfcf, fmt: mult, best: "lo", tip: FORMULAS.pfcf },
      { label: "FCF Yield", get: (s) => s.m.fcfYield, fmt: pct, best: "hi" },
      { label: "P/E vs 3-Year Median", get: (s) => s.m.peVsMedian, fmt: mult, best: "lo" },
      { label: "Analyst Target Upside", get: (s) => s.m.targetUpside, fmt: sgnPct, best: "hi" },
    ],
  },
  {
    title: "Price Momentum & Risk",
    rows: [
      { label: "Relative Strength vs SPY (6M)", get: (s) => s.m.rs6, fmt: sgnPp, best: "hi" },
      { label: "Relative Strength vs SPY (12M)", get: (s) => s.m.rs12, fmt: sgnPp, best: "hi" },
      { label: "Price vs 200-Day Average", get: (s) => s.m.vs200, fmt: sgnPct, best: "hi" },
      { label: "Volatility (annualised)", get: (s) => s.m.vol, fmt: pct, best: "lo" },
      { label: "Beta", get: (s) => s.m.beta, fmt: (v) => (isNum(v) ? v.toFixed(2) : "—"), best: "lo" },
      { label: "Net Debt / EBITDA", get: (s) => s.m.netDebt, fmt: mult, best: "lo" },
      { label: "Share Count Change (YoY)", get: (s) => s.m.shareChg, fmt: sgnPct, best: "lo" },
    ],
  },
  {
    title: "Factor Scores",
    rows: [
      factorRow("f01", "Revenue Acceleration"),
      factorRow("f02", "Profit Acceleration"),
      factorRow("f03", "Multiple-Expansion Room"),
      factorRow("f04", "Catalyst Strength"),
      factorRow("f05", "Cyclical vs. Secular Growth"),
      factorRow("f06", "Capital Allocation"),
      factorRow("f07", "2X / 5X / 10X Potential"),
      factorRow("f08", "Competitive Position"),
      factorRow("f09", "Margin Runway"),
      factorRow("f10", "Momentum"),
      factorRow("f11", "Key Thesis Dependency"),
      factorRow("f12", "Position Risk"),
    ],
  },
];

// ─── LOADER ──────────────────────────────────────────────────────────────────
const STEPS = [
  "Pulling financial statements",
  "Computing growth & quality engines",
  "Measuring price momentum",
  "Weighing valuation signals",
  "Assembling your comparison",
];

function CompareLoader({
  tickers,
  status,
  startedAt,
}: {
  tickers: string[];
  status: Record<string, string>;
  startedAt: number;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const secs = Math.floor((now - startedAt) / 1000);
  const step = Math.min(STEPS.length - 1, Math.floor(secs / 6));
  const done = tickers.filter((t) => status[t] === "done" || status[t] === "error").length;

  return (
    <div className="cl-wrap">
      <div className="cl-orbit">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" className="cl-ring" />
          <circle cx="60" cy="60" r="38" className="cl-ring cl-ring2" />
          <circle cx="60" cy="60" r="52" className="cl-arc" />
          <circle cx="60" cy="60" r="38" className="cl-arc cl-arc2" />
        </svg>
        <div className="cl-core">
          {done}/{tickers.length}
        </div>
      </div>

      <div className="cl-title">Scoring &amp; comparing stocks</div>
      <div className="cl-step" key={step}>
        {STEPS[step]}…
      </div>

      <div className="cl-list">
        {tickers.map((t) => {
          const st = status[t];
          return (
            <div className={`cl-item ${st || "loading"}`} key={t}>
              <span className="cl-dot" />
              <span className="cl-tk">{t}</span>
              <span className="cl-bar">
                <i />
              </span>
              <span className="cl-st">
                {st === "done"
                  ? "Ready"
                  : st === "cached"
                    ? "Loaded instantly"
                    : st === "error"
                      ? "Failed"
                      : "Scoring…"}
              </span>
            </div>
          );
        })}
      </div>
      <div className="cl-time">{secs}s elapsed · fresh scores can take up to a minute</div>
    </div>
  );
}

const LOADER_CSS = `
.cl-wrap{display:flex;flex-direction:column;align-items:center;padding:42px 18px 36px;text-align:center}
.cl-orbit{position:relative;width:120px;height:120px;margin-bottom:18px}
.cl-orbit svg{width:100%;height:100%;overflow:visible}
.cl-ring{fill:none;stroke:var(--line);stroke-width:2.5}
.cl-ring2{stroke-dasharray:2 7;stroke-linecap:round}
.cl-arc{fill:none;stroke:var(--blue);stroke-width:3;stroke-linecap:round;stroke-dasharray:70 260;transform-origin:60px 60px;animation:cl-rot 1.6s linear infinite}
.cl-arc2{stroke:var(--green);stroke-dasharray:40 200;animation:cl-rot-r 2.2s linear infinite}
.cl-core{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;color:var(--ink);animation:cl-pulse 2s ease-in-out infinite}
.cl-title{font-size:15px;font-weight:700;color:var(--ink)}
.cl-step{margin-top:6px;font-size:12.5px;color:var(--muted);animation:cl-in .4s ease both}
.cl-list{margin-top:22px;width:100%;max-width:440px;display:flex;flex-direction:column;gap:8px}
.cl-item{display:grid;grid-template-columns:10px 56px 1fr 112px;align-items:center;gap:10px;padding:9px 12px;border:1px solid var(--line);border-radius:8px;background:var(--card-2);font-size:12px;animation:cl-in .35s ease both}
.cl-dot{width:8px;height:8px;border-radius:50%;background:var(--amber);animation:cl-blink 1s ease-in-out infinite}
.cl-tk{font-weight:700;color:var(--ink);text-align:left}
.cl-bar{height:4px;border-radius:4px;background:var(--line);overflow:hidden;position:relative}
.cl-bar i{position:absolute;inset:0;width:40%;border-radius:4px;background:linear-gradient(90deg,transparent,var(--blue),transparent);animation:cl-slide 1.3s ease-in-out infinite}
.cl-st{text-align:right;color:var(--muted)}
.cl-item.done .cl-dot,.cl-item.cached .cl-dot{background:var(--green);animation:none}
.cl-item.done .cl-bar i,.cl-item.cached .cl-bar i{width:100%;animation:none;background:var(--green)}
.cl-item.done .cl-st,.cl-item.cached .cl-st{color:var(--green)}
.cl-item.error .cl-dot{background:var(--red);animation:none}
.cl-item.error .cl-bar i{width:100%;animation:none;background:var(--red)}
.cl-item.error .cl-st{color:var(--red)}
.cl-time{margin-top:16px;font-size:11px;color:var(--muted)}
@keyframes cl-rot{to{transform:rotate(360deg)}}
@keyframes cl-rot-r{to{transform:rotate(-360deg)}}
@keyframes cl-pulse{0%,100%{opacity:1}50%{opacity:.55}}
@keyframes cl-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes cl-blink{50%{opacity:.35}}
@keyframes cl-slide{0%{left:-40%}100%{left:100%}}
.cmp-sec td{background:var(--card-2);font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:8px 14px}
.cmp-lead{display:inline-block;margin-top:5px;padding:2px 7px;border-radius:10px;background:var(--green-bg);color:var(--green);font-size:10px;font-weight:700;letter-spacing:.04em}
.cmp-list{margin:0;padding-left:16px;text-align:left;font-size:11.5px;line-height:1.5;color:var(--ink-2);font-weight:400}
@media (prefers-reduced-motion:reduce){.cl-wrap *{animation:none!important}}
`;

// ─── PAGE ────────────────────────────────────────────────────────────────────
export default function ComparePage({
  onOpenStock,
}: {
  onOpenStock: (t: string) => void;
}) {
  const [cmp, setCmp] = useState<string[]>(["NVDA", "META", "AMD"]);
  const [stocks, setStocks] = useState<Record<string, Stock>>({});
  const [status, setStatus] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [startedAt, setStartedAt] = useState(Date.now());
  const started = useRef(false);

  /** Load whichever tickers aren't already known; cached ones resolve instantly. */
  const load = useCallback((tickers: string[]) => {
    tickers.forEach((t) => {
      const hit = getCached(t);
      if (hit) {
        setStocks((p) => ({ ...p, [t]: hit }));
        setStatus((p) => ({ ...p, [t]: "cached" }));
        return;
      }
      setStartedAt(Date.now());
      setStatus((p) => ({ ...p, [t]: "loading" }));
      setErrors((p) => {
        const { [t]: _, ...rest } = p;
        return rest;
      });
      loadStock(t)
        .then((s) => {
          setStocks((p) => ({ ...p, [t]: s }));
          setStatus((p) => ({ ...p, [t]: "done" }));
        })
        .catch((e: Error) => {
          setStatus((p) => ({ ...p, [t]: "error" }));
          setErrors((p) => ({ ...p, [t]: e.message }));
        });
    });
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    load(cmp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = () => {
    const t = input.trim().toUpperCase();
    if (!t || cmp.includes(t)) return;
    if (cmp.length >= MAX_TICKERS) {
      setError(`Compare up to ${MAX_TICKERS} tickers at a time.`);
      return;
    }
    if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(t)) {
      setError("Enter a valid ticker symbol.");
      return;
    }
    setError("");
    setCmp([...cmp, t]);
    setInput("");
    load([t]);
  };
  const remove = (t: string) => {
    setError("");
    setCmp(cmp.filter((x) => x !== t));
  };
  const clear = () => {
    setError("");
    setCmp([]);
  };
  const retry = (t: string) => load([t]);

  const loading = cmp.some((t) => status[t] === "loading" || !status[t]);
  const list = cmp.map((t) => stocks[t]).filter(Boolean);
  const failed = cmp.filter((t) => status[t] === "error");
  const leader = list.length > 1
    ? list.reduce((a, b) => ((a.score ?? -1) >= (b.score ?? -1) ? a : b))
    : null;

  /** Ticker(s) holding the best value in a row; none unless 2+ values exist. */
  const winners = (row: Row): Set<string> => {
    if (!row.best) return new Set();
    const vals = list
      .map((s) => [s.t, row.get(s)] as [string, any])
      .filter(([, v]) => isNum(v)) as [string, number][];
    if (vals.length < 2) return new Set();
    const target = (row.best === "hi" ? Math.max : Math.min)(...vals.map(([, v]) => v));
    return new Set(vals.filter(([, v]) => v === target).map(([t]) => t));
  };

  return (
    <div className="card">
      <style>{LOADER_CSS}</style>
      <div className="toolbar" style={{ alignItems: "center" }}>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
          Add tickers to compare
        </span>
        <div id="cmpChips" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {cmp.map((t) => (
            <span
              key={t}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "var(--card-2)",
                color: "var(--blue-dk)",
                padding: "5px 9px",
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 700,
                border: `1px solid ${status[t] === "error" ? "var(--red)" : "var(--line)"}`,
              }}
            >
              {t}
              <span
                style={{ cursor: "pointer", color: "var(--muted)" }}
                onClick={() => remove(t)}
              >
                ✕
              </span>
            </span>
          ))}
        </div>
        <input
          className="inp"
          style={{ maxWidth: 160, flex: "0 0 auto" }}
          placeholder="Add ticker…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="btn solid" onClick={add} disabled={loading}>
          Compare
        </button>
        <button className="btn" onClick={clear}>
          Clear
        </button>
      </div>

      {error && (
        <div style={{ padding: "10px 18px", color: "var(--red)", fontSize: 12.5 }}>
          {error}
        </div>
      )}
      {!loading &&
        failed.map((t) => (
          <div
            key={t}
            style={{ padding: "8px 18px", color: "var(--red)", fontSize: 12.5 }}
          >
            {t}: {errors[t] || "Could not be scored."}{" "}
            <span
              style={{ textDecoration: "underline", cursor: "pointer" }}
              onClick={() => retry(t)}
            >
              Retry
            </span>
          </div>
        ))}

      {loading ? (
        <CompareLoader
          tickers={cmp}
          status={status}
          startedAt={startedAt}
        />
      ) : !cmp.length ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
          Add a ticker above to start a comparison.
        </div>
      ) : !list.length ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
          No data returned for the selected tickers.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table id="cmpTable">
            <thead>
              <tr>
                <th>Metric</th>
                {list.map((s) => (
                  <th key={s.t} style={{ textAlign: "center", minWidth: 150 }}>
                    <div
                      className="tkr"
                      style={{ fontSize: 13 }}
                      onClick={() => onOpenStock(s.t)}
                    >
                      {s.t}
                    </div>
                    <div
                      style={{
                        fontWeight: 400,
                        textTransform: "none",
                        letterSpacing: 0,
                        marginTop: 3,
                      }}
                    >
                      {(s.name || "").split(",")[0]}
                    </div>
                    <div
                      style={{
                        fontWeight: 400,
                        textTransform: "none",
                        letterSpacing: 0,
                        marginTop: 2,
                        fontSize: 11,
                        color: "var(--muted)",
                      }}
                    >
                      {usd(s.price)} · {bigUsd(s.mcap)}
                    </div>
                    {leader && s.t === leader.t && (
                      <span className="cmp-lead">TOP SCORE</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 500 }}>Sector / Industry</td>
                {list.map((s) => (
                  <td key={s.t} style={{ textAlign: "center", fontSize: 11.5 }}>
                    {[s.sector, s.industry].filter(Boolean).join(" · ") || "—"}
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>Trend / Confidence</td>
                {list.map((s) => (
                  <td key={s.t} style={{ textAlign: "center", fontSize: 12 }}>
                    <span style={{ color: trendColor(s.trend), fontWeight: 600 }}>
                      {trendIcon(s.trend)} {s.trend || "—"}
                    </span>
                    <span style={{ color: "var(--muted)" }}>
                      {" "}
                      · {s.conf || "—"}
                    </span>
                  </td>
                ))}
              </tr>
              {SECTIONS.map((sec) => (
                <SectionRows
                  key={sec.title}
                  sec={sec}
                  list={list}
                  winners={winners}
                />
              ))}
              <tr className="cmp-sec">
                <td colSpan={list.length + 1}>Outlook</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500, verticalAlign: "top" }}>Key Catalysts</td>
                {list.map((s) => (
                  <td key={s.t} style={{ verticalAlign: "top" }}>
                    <ul className="cmp-list">
                      {s.catalysts.length
                        ? s.catalysts.map((c, i) => <li key={i}>{c}</li>)
                        : "—"}
                    </ul>
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ fontWeight: 500, verticalAlign: "top" }}>Main Risks</td>
                {list.map((s) => (
                  <td key={s.t} style={{ verticalAlign: "top" }}>
                    <ul className="cmp-list">
                      {s.risks.length
                        ? s.risks.map((c, i) => <li key={i}>{c}</li>)
                        : "—"}
                    </ul>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SectionRows({
  sec,
  list,
  winners,
}: {
  sec: Section;
  list: Stock[];
  winners: (r: Row) => Set<string>;
}) {
  return (
    <>
      <tr className="cmp-sec">
        <td colSpan={list.length + 1}>{sec.title}</td>
      </tr>
      {sec.rows.map((row) => {
        const win = winners(row);
        return (
          <tr key={row.label}>
            <td style={{ fontWeight: 500 }}>
              {row.label}
              {row.tip && <InfoTip label={row.label} text={row.tip} />}
            </td>
            {list.map((s) => {
              const v = row.get(s);
              return (
                <td
                  key={s.t}
                  className="num"
                  style={{
                    textAlign: "center",
                    background: win.has(s.t) ? "var(--green-bg)" : "transparent",
                    color: row.score && isNum(v) ? scoreColor(v) : "var(--ink)",
                    fontWeight: win.has(s.t) || row.score ? 600 : 400,
                  }}
                >
                  {row.fmt(v)}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
