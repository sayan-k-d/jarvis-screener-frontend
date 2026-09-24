"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const TICKERS_API = "/api/proxy?api=getTickers&page=0&size=13000";
const REPORT_WEBHOOK_URL =
  "https://n8n.srv1375926.hstgr.cloud/webhook/5df999e7-932a-4810-a956-b22a083ffd67";
const REPORT_AUTHOR = "LBWM Research";
const JARVIS_LOGO_URL = "https://jarvisintelligence.ai/images/J_logo.png";

// ─── TYPES ───────────────────────────────────────────────────────────────────
type IconType =
  | "chart" | "users" | "newspaper" | "dollar" | "arrows" | "search"
  | "trend" | "shield" | "star" | "sparkle" | "arrow" | "bars"
  | "doc" | "chevron" | "brain" | "external" | "check" | "close";

interface TickerRecord {
  idStock: number;
  stockName: string;
  company: string;
  sector?: string | null;
  industry?: string | null;
  country?: string | null;
  marketCapital?: string | null;
  logoFileDetails?: string | null;
  assetType?: string | null;
}

interface TickerSelection {
  ticker: string;
  company: string;
}

interface ChartData {
  title?: string;
  labels?: string[];
  values?: number[];
  values_usd_b?: number[];
  source?: string;
}

interface ReportPage1 {
  company_name?: string;
  ticker?: string;
  exchange?: string;
  report_date?: string;
  rating?: string;
  stock_price?: string;
  stock_price_date?: string;
  company_size?: string;
  company_rank?: string;
  sector?: string;
  industry?: string;
  author?: string;
  tagline?: string;
  in_this_fresh_look?: {
    summary_of_business?: string;
    recent_developments?: string;
    competitive_environment?: string;
    conclusions_recommendations?: string;
  };
  grab_and_go_thesis?: string;
}

interface ReportPage2 {
  data_as_of?: string;
  key_metrics?: Record<string, string | null>;
  insider_transactions?: string;
  summary_of_business?: string[];
  annual_report_url?: string;
  revenue_pie_chart?: ChartData;
}

interface ProductItem {
  name?: string;
  description?: string;
}
interface ReportPage3 {
  product_and_service_portfolio?: {
    intro?: string;
    products?: ProductItem[];
  };
  key_segment_chart?: ChartData;
}

interface StrategicTheme {
  title?: string;
  paragraphs?: string[];
}
interface ReportPage4 {
  strategic_themes?: StrategicTheme[];
  capex_chart?: ChartData;
}

interface AnalysisReport {
  page_1?: ReportPage1;
  page_2?: ReportPage2;
  page_3?: ReportPage3;
  page_4?: ReportPage4;
  sources?: string[];
}

// ─── SVG ICONS ───────────────────────────────────────────────────────────────
const Icon = ({ type }: { type: IconType }) => {
  const paths: Record<IconType, React.ReactNode> = {
    chart: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
    users: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    newspaper: (
      <>
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
        <path d="M18 14h-8" />
        <path d="M15 18h-5" />
        <path d="M10 6h8v4h-8z" />
      </>
    ),
    dollar: (
      <>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
    arrows: (
      <>
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </>
    ),
    trend: (
      <>
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </>
    ),
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    star: (
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    ),
    sparkle: (
      <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    ),
    arrow: <path d="M14 5l7 7m0 0l-7 7m7-7H3" />,
    bars: (
      <>
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </>
    ),
    doc: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </>
    ),
    chevron: <polyline points="6 9 12 15 18 9" />,
    brain: (
      <>
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z" />
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z" />
      </>
    ),
    external: (
      <>
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </>
    ),
    check: <polyline points="20 6 9 17 4 12" />,
    close: (
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      {paths[type] || paths.star}
    </svg>
  );
};

// ─── TIMER HOOK ──────────────────────────────────────────────────────────────
function useTimer(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else if (ref.current) {
      clearInterval(ref.current);
    }
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [running]);
  const reset = useCallback(() => setElapsed(0), []);
  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return { elapsed, fmt: fmt(elapsed), reset };
}

let TICKER_CACHE: TickerRecord[] | null = null;

// ─── HOME VIEW ───────────────────────────────────────────────────────────────
function HomeView({ onSearch }: { onSearch: (sel: TickerSelection) => void }) {
  const [tickers, setTickers] = useState<TickerRecord[]>(TICKER_CACHE || []);
  const [tickersLoading, setTickersLoading] = useState(!TICKER_CACHE);
  const [tickersError, setTickersError] = useState("");

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TickerRecord | null>(null);
  const [error, setError] = useState("");

  const wrapRef = useRef<HTMLDivElement>(null);

  const COMMON = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "NFLX"];

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
        const content: TickerRecord[] = Array.isArray(json)
          ? json
          : json?.content || [];
        if (!cancelled) {
          TICKER_CACHE = content;
          setTickers(content);
        }
      } catch (err) {
        if (!cancelled) {
          setTickersError("Couldn't load the ticker list. Please try again.");
        }
      } finally {
        if (!cancelled) setTickersLoading(false);
      }
    }
    loadTickers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filteredTickers = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    return tickers
      .filter(
        (t) =>
          t.stockName?.toUpperCase().includes(q) ||
          t.company?.toUpperCase().includes(q),
      )
      .slice(0, 50);
  }, [query, tickers]);

  const handleQueryChange = (v: string) => {
    setQuery(v);
    setOpen(true);
    if (selected) setSelected(null);
    if (error) setError("");
  };

  const handleSelectTicker = (t: TickerRecord) => {
    setSelected(t);
    setQuery(`${t.stockName} — ${t.company}`);
    setOpen(false);
    setError("");
  };

  const handleClearSelection = () => {
    setSelected(null);
    setQuery("");
    setOpen(false);
  };

  const handleChipClick = (symbol: string) => {
    const match = tickers.find((t) => t.stockName?.toUpperCase() === symbol);
    if (match) {
      handleSelectTicker(match);
    } else if (!tickersLoading) {
      setError(`${symbol} isn't in the ticker list.`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) {
      setError("Please select a ticker from the list.");
      return;
    }
    onSearch({ ticker: selected.stockName, company: selected.company });
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
        Select a ticker to generate a full equity research report as a
        downloadable PDF.
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
              placeholder={
                tickersLoading
                  ? "Loading tickers…"
                  : "Search ticker or company (e.g. AAPL, Apple)"
              }
              autoComplete="off"
              spellCheck={false}
              aria-label="Search ticker or company"
            />
            {selected && (
              <button
                type="button"
                className="ta-clear-btn"
                onClick={handleClearSelection}
                aria-label="Clear selection"
              >
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

        <div className="ta-ticker-field">
          <label htmlFor="ta-company-input">Company</label>
          <input
            id="ta-company-input"
            type="text"
            className="ta-company-readonly"
            value={selected?.company || ""}
            readOnly
            placeholder="Auto-filled from ticker selection"
          />
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
          <button
            key={t}
            className="ta-chip"
            type="button"
            onClick={() => handleChipClick(t)}
            disabled={tickersLoading}
          >
            {t}
          </button>
        ))}
      </div>

      <p className="ta-disclaimer">
        Not investment advice. For informational purposes only.
      </p>

      <style jsx>{`
        .ta-ticker-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
          width: 100%;
          max-width: 480px;
          margin: 0 auto;
        }
        .ta-ticker-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          text-align: left;
          position: relative;
        }
        .ta-ticker-field label {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          color: var(--muted, #8a9490);
        }
        .ta-ticker-combobox {
          position: relative;
        }
        .ta-ticker-combobox input,
        .ta-company-readonly {
          width: 100%;
          box-sizing: border-box;
          padding: 12px 40px 12px 14px;
          border-radius: 12px;
          border: 1px solid var(--line, #2a3530);
          background: var(--card-2, #12211a);
          color: var(--ink, #e8f0eb);
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s ease;
        }
        .ta-ticker-combobox input:focus {
          border-color: var(--blue, #4fa772);
        }
        .ta-company-readonly {
          padding-right: 14px;
          opacity: 0.8;
          cursor: default;
        }
        .ta-clear-btn {
          position: absolute;
          top: 50%;
          right: 8px;
          transform: translateY(-50%);
          width: 26px;
          height: 26px;
          border: none;
          background: transparent;
          color: var(--muted, #8a9490);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .ta-clear-btn :global(svg) {
          width: 16px;
          height: 16px;
          fill: none;
          stroke: currentColor;
          stroke-width: 2;
        }
        .ta-ticker-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          max-height: 260px;
          overflow-y: auto;
          background: var(--card-2, #12211a);
          border: 1px solid var(--line, #2a3530);
          border-radius: 12px;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35);
          z-index: 30;
        }
        .ta-ticker-dropdown-msg {
          padding: 14px;
          font-size: 13px;
          color: var(--muted, #8a9490);
        }
        .ta-ticker-option {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 14px;
          border: none;
          background: transparent;
          color: var(--ink, #e8f0eb);
          text-align: left;
          cursor: pointer;
          font-size: 13.5px;
        }
        .ta-ticker-option:hover {
          background: var(--row-hover, #1a2a22);
        }
        .ta-ticker-symbol {
          font-weight: 700;
          flex-shrink: 0;
        }
        .ta-ticker-company {
          color: var(--muted, #8a9490);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin-left: 12px;
        }
        .ta-generate-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 13px 22px;
          border-radius: 999px;
          border: none;
          background: var(--blue, #4fa772);
          color: #fff;
          font-weight: 700;
          font-size: 14.5px;
          cursor: pointer;
          transition:
            transform 0.15s ease,
            background 0.2s ease;
        }
        .ta-generate-btn:hover {
          transform: translateY(-1px);
        }
        .ta-generate-btn :global(svg) {
          width: 17px;
          height: 17px;
          fill: none;
          stroke: currentColor;
          stroke-width: 2.2;
        }
      `}</style>
    </div>
  );
}

// ─── GENERATING VIEW ─────────────────────────────────────────────────────────
const GENERATING_MESSAGES = [
  "Reviewing filings…",
  "Synthesizing financials…",
  "Cross-checking recent developments…",
  "Drafting the recommendation…",
  "Finalizing the report…",
];

function GeneratingView({
  ticker,
  company,
}: {
  ticker: string;
  company: string;
}) {
  const { elapsed, fmt: timerFmt } = useTimer(true);
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setMsgIdx((i) => (i + 1) % GENERATING_MESSAGES.length),
      2500,
    );
    return () => clearInterval(t);
  }, []);

  return (
    <div className="ta-root ta-loading-shell">
      <div className="ta-loading-card">
        <div className="ta-loading-top">
          <span className="ta-spinning">↻</span>
          <span className="ta-loading-headline">Generating your report…</span>
        </div>
        <p className="ta-loading-sub">
          Building the equity research report for <span>{ticker}</span>
          {company ? ` — ${company}` : ""}
        </p>
        <p className="ta-loading-sub" style={{ opacity: 0.75 }}>
          {GENERATING_MESSAGES[msgIdx]}
        </p>
        <div className="ta-loading-top" style={{ marginTop: 18 }}>
          <span>{timerFmt}</span>
        </div>
        {elapsed > 20 && (
          <p className="ta-loading-sub" style={{ opacity: 0.6, fontSize: 12 }}>
            This can take up to a minute or two.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── REPORT READY VIEW ───────────────────────────────────────────────────────
function ReportReadyView({
  ticker,
  company,
  onDownload,
  onReset,
}: {
  ticker: string;
  company: string;
  onDownload: () => void;
  onReset: () => void;
}) {
  return (
    <div className="ta-root ta-loading-shell">
      <div className="ta-loading-card ta-ready-card">
        <div className="ta-ready-icon">
          <Icon type="check" />
        </div>
        <span className="ta-loading-headline">Your report is ready</span>
        <p className="ta-loading-sub">
          <span>{ticker}</span>
          {company ? ` — ${company}` : ""}
        </p>
        <div className="ta-ready-actions">
          <button type="button" className="ta-generate-btn" onClick={onDownload}>
            <Icon type="doc" />
            Download PDF
          </button>
          <button type="button" className="ta-secondary-btn" onClick={onReset}>
            Run Another Analysis
          </button>
        </div>
      </div>
      <style jsx>{`
        .ta-ready-icon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(79, 167, 114, 0.16);
          color: var(--blue, #4fa772);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 14px;
        }
        .ta-ready-icon :global(svg) {
          width: 26px;
          height: 26px;
          fill: none;
          stroke: currentColor;
          stroke-width: 2.5;
        }
        .ta-ready-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 22px;
          align-items: center;
        }
        .ta-secondary-btn {
          background: transparent;
          border: none;
          color: var(--muted, #8a9490);
          font-size: 13px;
          cursor: pointer;
          text-decoration: underline;
        }
        .ta-secondary-btn:hover {
          color: var(--ink, #e8f0eb);
        }
      `}</style>
    </div>
  );
}

// ─── ERROR VIEW ──────────────────────────────────────────────────────────────
function ErrorView({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="ta-root ta-loading-shell">
      <div className="ta-loading-card">
        <span className="ta-loading-headline">Something went wrong</span>
        <p className="ta-loading-sub">{message}</p>
        <button
          type="button"
          className="ta-generate-btn"
          style={{ marginTop: 18 }}
          onClick={onRetry}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

// ─── PDF HELPERS ─────────────────────────────────────────────────────────────
type RGB = [number, number, number];

// Strip AI search-citation markers (e.g. "citeturn5view2", "citeturn2view2turn8view3")
// that appear inside the webhook's text fields — they'd render as garbage in the PDF.
function clean(text?: string): string {
  return (text || "")
    .replace(/cite(?:turn\d+(?:view|search|news|forecast)\d+)+/gi, "")
    .replace(/turn\d+(?:view|search|news|forecast)\d+/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:)])/g, "$1")
    .trim();
}

// Nice, report-style labels for the flat key_metrics object.
const METRIC_LABELS: Record<string, string> = {
  enterprise_value: "Enterprise Value",
  market_cap: "Market Cap",
  revenue_fwd_ttm: "Revenue Fwd (TTM)",
  ytd_return: "YTD Return",
  fwd_ttm_pe: "Fwd (TTM) P/E",
  rsi: "RSI",
  ebitda_margin_ttm: "EBITDA Margin (TTM)",
  revenue_growth_ttm_yoy: "Revenue Growth (TTM, YoY)",
  roic_ttm: "ROIC (TTM)",
  cfo_3y_cagr: "CFO 3Y CAGR",
  fcf_3y_cagr: "FCF 3Y CAGR",
  revenue_3y_cagr: "Revenue 3Y CAGR",
  week_52_high: "52-Week High",
  week_52_low: "52-Week Low",
  moving_avg_200d: "200-Day Moving Avg",
  ebitda_ttm: "EBITDA (TTM)",
  cfo_ttm: "CFO (TTM)",
  fcf_ttm: "FCF (TTM)",
};

const METRIC_ACRONYMS = new Set([
  "pe", "ttm", "roic", "cfo", "fcf", "rsi", "ytd", "ebitda", "cagr", "yoy", "ev", "usd",
]);
function formatMetricLabel(key: string): string {
  if (METRIC_LABELS[key]) return METRIC_LABELS[key];
  return key
    .split("_")
    .map((w) =>
      METRIC_ACRONYMS.has(w.toLowerCase())
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

// Best-effort logo load → dataURL (needs CORS-clean image); returns null on failure.
async function loadLogoDataUrl(url: string): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("logo load failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 120;
    canvas.height = img.naturalHeight || 120;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

// ─── PDF GENERATION ──────────────────────────────────────────────────────────
async function generateAnalysisPdf(
  report: AnalysisReport,
  selection: TickerSelection,
) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const margin = 44;
  const headerH = 46;
  const contentTop = margin + headerH + 6;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 42;
  let y = contentTop;

  const ink: RGB = [26, 32, 28];
  const muted: RGB = [110, 116, 108];
  const green: RGB = [31, 91, 57];
  const greenMid: RGB = [74, 140, 90];
  const border: RGB = [214, 226, 218];
  const yellowBg: RGB = [253, 246, 214];
  const yellowBorder: RGB = [214, 178, 43];

  const logo = await loadLogoDataUrl(JARVIS_LOGO_URL);

  const p1 = report.page_1 || {};
  const headerTicker = p1.ticker || selection.ticker || "";
  const headerDate = (() => {
    const d = new Date(p1.report_date || "");
    if (!isNaN(d.getTime())) {
      return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
    }
    return p1.report_date || "";
  })();

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) {
      doc.addPage();
      y = contentTop;
    }
  };
  const newSection = () => {
    doc.addPage();
    y = contentTop;
  };

  const heading = (text: string, size = 15) => {
    ensureSpace(size + 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(...green);
    doc.text(text, margin, y);
    y += size + 8;
  };
  const subheading = (text: string, size = 11.5) => {
    if (!text) return;
    ensureSpace(size + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(...ink);
    doc.text(text, margin, y);
    y += size + 5;
  };
  const paragraph = (text?: string, size = 9.5, italic = false) => {
    const t = clean(text);
    if (!t) return;
    doc.setFont("helvetica", italic ? "italic" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...ink);
    const lines = doc.splitTextToSize(t, contentWidth) as string[];
    lines.forEach((line) => {
      ensureSpace(size * 1.42);
      doc.text(line, margin, y);
      y += size * 1.42;
    });
    y += 6;
  };
  const label = (text: string, size = 8.5) => {
    ensureSpace(size + 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(...muted);
    doc.text(text.toUpperCase(), margin, y);
    y += size + 4;
  };
  const divider = () => {
    ensureSpace(14);
    doc.setDrawColor(...border);
    doc.setLineWidth(0.75);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;
  };

  // ── chart drawers ──────────────────────────────────────────────────────────
  const PIE_COLORS: RGB[] = [
    [46, 109, 89], [74, 140, 90], [120, 175, 105],
    [165, 205, 150], [205, 225, 195], [90, 130, 110], [40, 90, 70],
  ];

  const drawPieChart = (chart?: ChartData) => {
    if (!chart) return;
    const labels = chart.labels || [];
    const values = chart.values_usd_b || chart.values || [];
    if (!labels.length || !values.length) return;
    const total = values.reduce((a, b) => a + (Number(b) || 0), 0);
    if (total <= 0) return;

    const blockH = 190;
    ensureSpace(blockH + 30);
    divider();
    subheading(clean(chart.title) || "Chart");

    const cx = margin + 78;
    const cy = y + 78;
    const r = 70;
    let a0 = -Math.PI / 2;
    const isB = !!chart.values_usd_b;
    const fmtVal = (v: number) =>
      isB ? `$${v.toFixed(2)}B` : `$${Math.round(v).toLocaleString("en-US")}`;

    values.forEach((raw, i) => {
      const v = Number(raw) || 0;
      const frac = v / total;
      const a1 = a0 + frac * Math.PI * 2;
      const col = PIE_COLORS[i % PIE_COLORS.length];
      doc.setFillColor(...col);
      const step = Math.max(0.05, (a1 - a0) / 24);
      for (let a = a0; a < a1 - 1e-6; a += step) {
        const b = Math.min(a + step, a1);
        doc.triangle(
          cx, cy,
          cx + r * Math.cos(a), cy + r * Math.sin(a),
          cx + r * Math.cos(b), cy + r * Math.sin(b),
          "F",
        );
      }
      a0 = a1;
    });

    // legend
    let ly = y + 14;
    const lx = cx + r + 26;
    labels.forEach((lab, i) => {
      const v = Number(values[i]) || 0;
      const col = PIE_COLORS[i % PIE_COLORS.length];
      doc.setFillColor(...col);
      doc.rect(lx, ly - 7, 9, 9, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...ink);
      const pctTxt = `${((v / total) * 100).toFixed(1)}%`;
      const text = `${clean(lab)} — ${fmtVal(v)} (${pctTxt})`;
      const wrapped = doc.splitTextToSize(text, contentWidth - (lx - margin) - 4) as string[];
      wrapped.forEach((wln, k) => {
        doc.text(wln, lx + 15, ly + k * 12);
      });
      ly += Math.max(16, wrapped.length * 12 + 4);
    });

    y = Math.max(cy + r + 14, ly) + 6;
    if (chart.source) paragraph(clean(chart.source), 8);
  };

  const drawBarChart = (chart?: ChartData) => {
    if (!chart) return;
    const labels = chart.labels || [];
    const values = (chart.values_usd_b || chart.values || []).map((v) => Number(v) || 0);
    if (!labels.length || !values.length) return;

    const chartH = 150;
    ensureSpace(chartH + 60);
    divider();
    subheading(clean(chart.title) || "Chart");

    const plotX = margin + 6;
    const plotY = y;
    const plotW = contentWidth - 12;
    const plotH = chartH;
    const baseY = plotY + plotH;
    const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1);
    const isB = !!chart.values_usd_b;
    const anyNeg = values.some((v) => v < 0);

    const fmtBar = (v: number) => {
      if (isB) return `$${v.toFixed(1)}B`;
      const s = "$" + Math.abs(v).toLocaleString("en-US");
      return v < 0 ? `(${s})` : s;
    };

    // baseline
    doc.setDrawColor(...border);
    doc.setLineWidth(0.75);
    doc.line(plotX, baseY, plotX + plotW, baseY);

    const n = values.length;
    const slot = plotW / n;
    const bw = Math.min(48, slot * 0.55);
    values.forEach((v, i) => {
      const h = (Math.abs(v) / maxAbs) * (plotH - 22);
      const bx = plotX + i * slot + (slot - bw) / 2;
      const by = baseY - h;
      doc.setFillColor(...greenMid);
      doc.rect(bx, by, bw, h, "F");
      // value label
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...ink);
      doc.text(fmtBar(v), bx + bw / 2, by - 4, { align: "center" });
      // x label
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...muted);
      doc.text(clean(labels[i] || ""), bx + bw / 2, baseY + 12, { align: "center" });
    });

    y = baseY + 24;
    if (anyNeg) {
      // note nothing extra; parens already convey sign
    }
    if (chart.source) paragraph(clean(chart.source), 8);
  };

  // ── PAGE 1: COVER / FRESH LOOK ──────────────────────────────────────────────
  // Company name + ticker (centered)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...green);
  const nameLines = doc.splitTextToSize(
    (p1.company_name || selection.company || "").toUpperCase(),
    contentWidth - 40,
  ) as string[];
  nameLines.forEach((ln) => {
    doc.text(ln, pageWidth / 2, y, { align: "center" });
    y += 24;
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...muted);
  doc.text(`(Ticker: ${p1.ticker || selection.ticker || "—"})`, pageWidth / 2, y, {
    align: "center",
  });
  y += 22;

  // Traffic-light gauge
  {
    const rating = (p1.rating || "").toUpperCase();
    const active = rating.includes("GREEN")
      ? 0
      : rating.includes("YELLOW")
      ? 1
      : rating.includes("RED")
      ? 2
      : -1;
    const lights: [string, RGB][] = [
      ["GREEN", [58, 166, 85]],
      ["YELLOW", [241, 181, 58]],
      ["RED", [224, 71, 58]],
    ];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text("LBWM RECOMMENDATION", pageWidth / 2, y, { align: "center" });
    y += 12;
    const gap = 58;
    const startX = pageWidth / 2 - gap;
    lights.forEach(([lab, col], i) => {
      const cx = startX + i * gap;
      const on = i === active;
      if (on) {
        doc.setFillColor(...col);
      } else {
        doc.setFillColor(224, 228, 224);
      }
      doc.circle(cx, y + 8, 8, "F");
      if (on) {
        doc.setDrawColor(...col);
        doc.setLineWidth(1.4);
        doc.circle(cx, y + 8, 11, "S");
      }
      doc.setFont("helvetica", on ? "bold" : "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...(on ? col : muted));
      doc.text(lab, cx, y + 26, { align: "center" });
    });
    y += 40;
  }

  // Green info grid (2 rows × 3 cols)
  {
    const cells: [string, string][] = [
      ["Stock Price", clean(`${p1.stock_price || "—"}${p1.stock_price_date ? ` (${p1.stock_price_date})` : ""}`)],
      ["Company Size", clean(p1.company_size || "—")],
      ["Author", clean(p1.author || REPORT_AUTHOR)],
      ["Company Rank", clean(p1.company_rank || "—")],
      ["Sector", clean(p1.sector || "—")],
      ["Industry", clean(p1.industry || "—")],
    ];
    const cw = contentWidth / 3;
    const ch = 40;
    const gy = y;
    cells.forEach((c, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cx = margin + col * cw;
      const cyy = gy + row * ch;
      doc.setFillColor(...green);
      doc.rect(cx + 1.5, cyy + 1.5, cw - 3, ch - 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(210, 230, 216);
      doc.text(c[0].toUpperCase(), cx + 8, cyy + 14);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      const v = (doc.splitTextToSize(c[1], cw - 16) as string[])[0] || "—";
      doc.text(v, cx + 8, cyy + 28);
    });
    y = gy + ch * 2 + 14;
  }

  // Tagline
  paragraph(p1.tagline, 10, true);
  divider();

  // "IN THIS FRESH LOOK WE'LL COVER" — two columns
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...green);
  doc.text("IN THIS FRESH LOOK WE'LL COVER:", pageWidth / 2, y, { align: "center" });
  y += 18;

  {
    const gapCol = 20;
    const leftW = (contentWidth - gapCol) * 0.56;
    const rightW = contentWidth - gapCol - leftW;
    const lx = margin;
    const rx = margin + leftW + gapCol;
    const topY = y;

    const writeCol = (
      text: string,
      x: number,
      startY: number,
      w: number,
      size: number,
      color: RGB,
      style: "normal" | "bold" | "italic",
      gap = 1.4,
    ) => {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(clean(text), w) as string[];
      let yy = startY;
      lines.forEach((l) => {
        doc.text(l, x, yy);
        yy += size * gap;
      });
      return yy;
    };

    // left column: the four sections
    let yL = topY;
    const fresh = p1.in_this_fresh_look || {};
    const sections: [string, string | undefined][] = [
      ["Summary of the Business", fresh.summary_of_business],
      ["Recent Developments", fresh.recent_developments],
      ["Competitive Environment", fresh.competitive_environment],
      ["Conclusions / Recommendations", fresh.conclusions_recommendations],
    ];
    sections.forEach(([title, body]) => {
      if (!body) return;
      yL = writeCol(title, lx, yL, leftW, 9.5, green, "bold");
      yL += 2;
      yL = writeCol(body, lx, yL, leftW, 8.8, ink, "normal");
      yL += 8;
    });

    // right column: Grab-and-Go Thesis box
    let yR = topY;
    const thesis = clean(p1.grab_and_go_thesis);
    if (thesis) {
      const pad = 12;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.8);
      const bodyLines = doc.splitTextToSize(thesis, rightW - pad * 2) as string[];
      const titleH = 18;
      const boxH = pad * 2 + titleH + bodyLines.length * 8.8 * 1.4;
      doc.setFillColor(...yellowBg);
      doc.setDrawColor(...yellowBorder);
      doc.setLineWidth(1);
      doc.roundedRect(rx, topY, rightW, boxH, 6, 6, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...green);
      doc.text("Grab-and-Go Thesis", rx + pad, topY + pad + 8);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.8);
      doc.setTextColor(58, 58, 50);
      let ty = topY + pad + titleH + 6;
      bodyLines.forEach((l) => {
        doc.text(l, rx + pad, ty);
        ty += 8.8 * 1.4;
      });
      yR = topY + boxH;
    }

    y = Math.max(yL, yR) + 6;
  }

  // ── PAGE 2: KEY METRICS ─────────────────────────────────────────────────────
  const p2 = report.page_2;
  if (p2) {
    newSection();
    heading("Key Metrics", 16);
    if (p2.data_as_of) paragraph(`Data as of: ${p2.data_as_of}`, 8.5);

    if (p2.key_metrics) {
      const entries = Object.entries(p2.key_metrics);
      const rows: string[][] = [];
      for (let i = 0; i < entries.length; i += 3) {
        const chunk = entries.slice(i, i + 3);
        const row: string[] = [];
        for (let k = 0; k < 3; k++) {
          if (chunk[k]) {
            row.push(formatMetricLabel(chunk[k][0]));
            row.push(clean(chunk[k][1] ?? "N/A") || "N/A");
          } else {
            row.push("", "");
          }
        }
        rows.push(row);
      }
      ensureSpace(120);
      autoTable(doc, {
        startY: y,
        body: rows,
        theme: "grid",
        styles: { fontSize: 8.2, cellPadding: 5, lineColor: border, lineWidth: 0.5 },
        columnStyles: {
          0: { fillColor: green, textColor: 255, fontStyle: "bold", cellWidth: 78 },
          2: { fillColor: green, textColor: 255, fontStyle: "bold", cellWidth: 78 },
          4: { fillColor: green, textColor: 255, fontStyle: "bold", cellWidth: 78 },
          1: { fillColor: [240, 246, 242], textColor: ink, fontStyle: "bold" },
          3: { fillColor: [240, 246, 242], textColor: ink, fontStyle: "bold" },
          5: { fillColor: [240, 246, 242], textColor: ink, fontStyle: "bold" },
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 16;
    }

    if (p2.insider_transactions) {
      const txt = clean(p2.insider_transactions);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(`Insider Transactions: ${txt}`, contentWidth - 20) as string[];
      const boxH = lines.length * 9 * 1.4 + 14;
      ensureSpace(boxH + 8);
      doc.setFillColor(...yellowBg);
      doc.setDrawColor(...yellowBorder);
      doc.setLineWidth(1);
      doc.roundedRect(margin, y, contentWidth, boxH, 4, 4, "FD");
      doc.setTextColor(120, 90, 0);
      let ty = y + 14;
      lines.forEach((l) => {
        doc.text(l, margin + 10, ty);
        ty += 9 * 1.4;
      });
      y += boxH + 14;
    }

    if (p2.summary_of_business?.length) {
      heading("Summary of Business", 14);
      p2.summary_of_business.forEach((para) => paragraph(`•  ${clean(para)}`));
    }

    if (p2.annual_report_url) {
      subheading("Annual Report");
      ensureSpace(16);
      doc.setTextColor(...green);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.textWithLink("View filing →", margin, y, { url: p2.annual_report_url });
      y += 18;
    }

    drawPieChart(p2.revenue_pie_chart);
  }

  // ── PAGE 3: PRODUCT & SERVICE PORTFOLIO ─────────────────────────────────────
  const p3 = report.page_3;
  if (p3) {
    newSection();
    heading("Product & Service Portfolio", 16);
    const portfolio = p3.product_and_service_portfolio;
    if (portfolio?.intro) paragraph(portfolio.intro);
    portfolio?.products?.forEach((prod) => {
      subheading(clean(prod.name || ""));
      paragraph(prod.description);
    });
    drawBarChart(p3.key_segment_chart);
  }

  // ── PAGE 4: STRATEGIC THEMES ────────────────────────────────────────────────
  const p4 = report.page_4;
  if (p4) {
    newSection();
    heading("Strategic Themes", 16);
    p4.strategic_themes?.forEach((theme) => {
      subheading(clean(theme.title || ""));
      theme.paragraphs?.forEach((para) => paragraph(para));
    });
    drawBarChart(p4.capex_chart);
  }

  // ── SOURCES ─────────────────────────────────────────────────────────────────
  if (report.sources?.length) {
    newSection();
    heading("Sources", 16);
    report.sources.forEach((src, i) => paragraph(`${i + 1}. ${clean(src)}`, 8.5));
  }

  // ── HEADER + FOOTER on every page ───────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // header band
    doc.setFillColor(238, 241, 238);
    doc.rect(0, 0, pageWidth, headerH, "F");
    let bx = margin;
    if (logo) {
      try {
        doc.addImage(logo, "PNG", margin, 9, 26, 26);
        bx = margin + 34;
      } catch {
        bx = margin;
      }
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...green);
    doc.text("JARVIS", bx, 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text("FRESH LOOK", bx, 33);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...green);
    doc.text(
      `STOCK: ${headerTicker}${headerDate ? `  |  ${headerDate}` : ""}`,
      pageWidth - margin,
      26,
      { align: "right" },
    );
    doc.setDrawColor(...border);
    doc.setLineWidth(0.75);
    doc.line(margin, headerH, pageWidth - margin, headerH);

    // footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(clean(p1.author || REPORT_AUTHOR), margin, pageHeight - 22);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 22, {
      align: "right",
    });
  }

  const safeTicker = (selection.ticker || "report").replace(/[^a-z0-9]/gi, "_");
  doc.save(
    `${safeTicker}_FreshLook_${new Date().toISOString().split("T")[0]}.pdf`,
  );
}

// ─── PAGE ROOT ───────────────────────────────────────────────────────────────
type ViewState = "home" | "generating" | "ready" | "error";

export default function StockAnalysisPage() {
  const [view, setView] = useState<ViewState>("home");
  const [selection, setSelection] = useState<TickerSelection | null>(null);
  const [reportData, setReportData] = useState<AnalysisReport | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSearch = async (sel: TickerSelection) => {
    setSelection(sel);
    setErrorMsg("");
    setView("generating");
    try {
      const res = await fetch(REPORT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: sel.company,
          ticker: sel.ticker,
          author: REPORT_AUTHOR,
        }),
      });
      if (!res.ok) {
        throw new Error(`Report generation failed (${res.status}).`);
      }
      const json = await res.json();
      const output: AnalysisReport | undefined = json?.output;
      if (!output) {
        throw new Error("The report service returned an unexpected response.");
      }
      setReportData(output);
      // Auto-download immediately, then show a confirmation screen.
      await generateAnalysisPdf(output, sel);
      setView("ready");
    } catch (err) {
      setErrorMsg(
        (err as Error).message || "Something went wrong generating the report.",
      );
      setView("error");
    }
  };

  const handleDownload = async () => {
    if (!reportData || !selection) return;
    await generateAnalysisPdf(reportData, selection);
  };

  const handleReset = () => {
    setSelection(null);
    setReportData(null);
    setErrorMsg("");
    setView("home");
  };

  return (
    <>
      {view === "home" && <HomeView onSearch={handleSearch} />}
      {view === "generating" && selection && (
        <GeneratingView ticker={selection.ticker} company={selection.company} />
      )}
      {view === "ready" && selection && (
        <ReportReadyView
          ticker={selection.ticker}
          company={selection.company}
          onDownload={handleDownload}
          onReset={handleReset}
        />
      )}
      {view === "error" && (
        <ErrorView message={errorMsg} onRetry={handleReset} />
      )}
    </>
  );
}