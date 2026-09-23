// Display formatting + row adapter, ported from the original app. The backend
// returns raw numeric scored rows; the frontend formats them for display.

export const clampN = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));

// Coerce anything (number | string | null | undefined) to a finite number or NaN.
const n = (v: any): number => {
  const x = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(x) ? x : NaN;
};

export function fmtCap(m: any): string {
  m = +m || 0;
  return m >= 1e12
    ? "$" + (m / 1e12).toFixed(2) + "T"
    : m >= 1e9
      ? "$" + (m / 1e9).toFixed(0) + "B"
      : m >= 1e6
        ? "$" + (m / 1e6).toFixed(0) + "M"
        : "—";
}
export function fmtBig(v: any): string {
  v = +v;
  const a = Math.abs(v);
  if (!isFinite(v)) return "—";
  return (
    (v < 0 ? "-" : "") +
    (a >= 1e12
      ? "$" + (a / 1e12).toFixed(2) + "T"
      : a >= 1e9
        ? "$" + (a / 1e9).toFixed(1) + "B"
        : a >= 1e6
          ? "$" + (a / 1e6).toFixed(1) + "M"
          : "$" + a.toFixed(0))
  );
}
export function pct(v: number, d = 1): string {
  return isFinite(v) ? (v >= 0 ? "+" : "") + v.toFixed(d) + "%" : "—";
}

const SECTOR_SHORT: Record<string, string> = {
  Technology: "Technology",
  "Communication Services": "Communication",
  "Consumer Cyclical": "Consumer Cyclical",
  "Consumer Defensive": "Consumer Defensive",
  "Financial Services": "Financial",
  Healthcare: "Healthcare",
  Industrials: "Industrials",
  Energy: "Energy",
  "Basic Materials": "Materials",
  "Real Estate": "Real Estate",
  Utilities: "Utilities",
};
const AV_SECTOR: Record<string, string> = {
  TECHNOLOGY: "Technology",
  "COMMUNICATION SERVICES": "Communication",
  "CONSUMER CYCLICAL": "Consumer Cyclical",
  "CONSUMER DEFENSIVE": "Consumer Defensive",
  "FINANCIAL SERVICES": "Financial",
  FINANCE: "Financial",
  HEALTHCARE: "Healthcare",
  "LIFE SCIENCES": "Healthcare",
  INDUSTRIALS: "Industrials",
  MANUFACTURING: "Industrials",
  ENERGY: "Energy",
  "BASIC MATERIALS": "Materials",
  "REAL ESTATE": "Real Estate",
  UTILITIES: "Utilities",
  "TRADE & SERVICES": "Consumer Cyclical",
  "TECHNOLOGY SERVICES": "Technology",
};
export function normSector(s: string): string {
  if (!s) return "";
  const up = s.toUpperCase();
  if (AV_SECTOR[up]) return AV_SECTOR[up];
  if (SECTOR_SHORT[s]) return SECTOR_SHORT[s];
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface AdaptedRow {
  [k: string]: any;
  sc: number;
  n: string;
  r: number;
  s: string;
  ind: string;
  g: number[];
  priceStr: string;
  capStr: string;
  hiStr: string;
  loStr: string;
  betaStr: string;
  volStr: string;
  roicStr: string;
  evStr: string;
  pfcfStr: string;
  peStr: string;
  hist: number[];
}

// Ported verbatim, but hardened: partial-run rows can arrive with null/missing
// numeric fields, so every value is coerced with n() and every derived number
// is defaulted — nothing here can throw on null/undefined.
export function adaptRow(r: any): AdaptedRow {
  r = r || {};
  const composite = n(r.composite);
  r.sc = Number.isFinite(composite) ? composite : 0;
  r.n = r.name || r.t || "—";
  r.r = Number.isFinite(n(r.rank)) ? n(r.rank) : 0;
  r.s = normSector(r.sector) || "—";
  r.ind = r.industry || "—";
  r.g = [r.subA, r.subB, r.subC, r.subD, r.subE].map((v) =>
    Number.isFinite(n(v)) ? n(v) : 0,
  );
  r.priceStr = isFinite(n(r.price)) ? "$" + n(r.price).toFixed(2) : "—";
  r.capStr = fmtCap(r.marketCap);
  r.hiStr = isFinite(n(r.yearHigh)) ? "$" + n(r.yearHigh).toFixed(2) : "—";
  r.loStr = isFinite(n(r.yearLow)) ? "$" + n(r.yearLow).toFixed(2) : "—";
  r.betaStr = isFinite(n(r.beta)) ? n(r.beta).toFixed(2) : "—";
  r.volStr = isFinite(n(r.volume)) ? (n(r.volume) / 1e6).toFixed(1) + "M" : "—";
  r.roicStr = isFinite(n(r.roic)) ? (n(r.roic) * 100).toFixed(1) + "%" : "—";
  r.evStr = isFinite(n(r.evEbitda)) ? n(r.evEbitda).toFixed(1) : "—";
  r.pfcfStr = isFinite(n(r.pfcf)) ? n(r.pfcf).toFixed(1) : "—";
  r.peStr = isFinite(n(r.trailingPE)) ? n(r.trailingPE).toFixed(1) : "—";
  const base = r.sc;
  const hist: number[] = [];
  for (let i = 7; i >= 0; i--)
    hist.push(clampN(Math.round(base - i * 1.5 + Math.sin(i) * 2), 1, 100));
  r.hist = hist;
  return r as AdaptedRow;
}

export function tierClass(t: string): string {
  return t === "High Alert"
    ? "b-alert"
    : t === "Watch"
      ? "b-watch"
      : t === "Neutral" || t === "Weakening"
        ? "b-watch"
        : "b-break";
}

// ---- news sentiment helpers ----
export function sentimentBand(score: number): { label: string; cls: string } {
  if (!isFinite(score)) return { label: "Neutral", cls: "neu" };
  if (score <= -0.35) return { label: "Bearish", cls: "bear" };
  if (score <= -0.15) return { label: "Somewhat-Bearish", cls: "sbear" };
  if (score < 0.15) return { label: "Neutral", cls: "neu" };
  if (score < 0.35) return { label: "Somewhat-Bullish", cls: "sbull" };
  return { label: "Bullish", cls: "bull" };
}
export function parseAvTime(t: string): Date | null {
  if (!t || t.length < 15) return null;
  const y = +t.slice(0, 4),
    mo = +t.slice(4, 6) - 1,
    d = +t.slice(6, 8),
    h = +t.slice(9, 11),
    mi = +t.slice(11, 13);
  const dt = new Date(Date.UTC(y, mo, d, h, mi));
  return isNaN(dt.getTime()) ? null : dt;
}
export function relTime(dt: Date | null): string {
  if (!dt) return "";
  const s = (Date.now() - dt.getTime()) / 1000;
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m ago";
  if (s < 86400) return Math.round(s / 3600) + "h ago";
  const days = Math.round(s / 86400);
  if (days < 30) return days + "d ago";
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const num = (v: any): number => {
  const x = parseFloat(v);
  return isFinite(x) ? x : NaN;
};

// Parse a raw NEWS_SENTIMENT payload into a clean list for a given ticker.
export function parseNews(j: any, sym: string): { items: any[]; avg: number } {
  const feed = Array.isArray(j?.feed) ? j.feed : [];
  const items = feed
    .map((a: any) => {
      let tScore = NaN,
        tLabel = "",
        rel = NaN;
      const ts = Array.isArray(a.ticker_sentiment) ? a.ticker_sentiment : [];
      const mine = ts.find(
        (x: any) => String(x.ticker).toUpperCase() === sym.toUpperCase(),
      );
      if (mine) {
        tScore = num(mine.ticker_sentiment_score);
        tLabel = mine.ticker_sentiment_label || "";
        rel = num(mine.relevance_score);
      }
      if (!isFinite(tScore)) tScore = num(a.overall_sentiment_score);
      return {
        title: a.title || "(untitled)",
        url: a.url || "#",
        source: a.source || "",
        summary: a.summary || "",
        time: parseAvTime(a.time_published),
        score: tScore,
        label: tLabel || sentimentBand(tScore).label,
        relevance: rel,
      };
    })
    .sort(
      (x: any, y: any) =>
        (isFinite(y.relevance) ? y.relevance : 0) -
        (isFinite(x.relevance) ? x.relevance : 0),
    );
  const avg = items.length
    ? items.reduce(
        (s: number, i: any) => s + (isFinite(i.score) ? i.score : 0),
        0,
      ) / items.length
    : NaN;
  return { items, avg };
}

export function qLabel(end: string): string {
  if (!end || end.length < 7) return "—";
  const y = +end.slice(0, 4),
    m = +end.slice(5, 7);
  const q = Math.min(4, Math.ceil(m / 3));
  return `Q${q} FY${String(y).slice(2)}`;
}
