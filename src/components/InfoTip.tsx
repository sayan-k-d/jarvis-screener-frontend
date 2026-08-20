"use client";
import React, { useState, useRef, useId } from "react";

/**
 * Lightweight, dependency-free tooltip. Hover (desktop) or tap (touch) the small
 * info glyph to reveal the exact formula used for a value. Positioned with a
 * fixed-position portal-free layer so it never gets clipped by table overflow.
 */
export function InfoTip({ text, label }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  const show = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top });
    setOpen(true);
  };
  const hide = () => setOpen(false);

  return (
    <>
      <span
        ref={ref}
        role="button"
        tabIndex={0}
        aria-label={label ? `${label} formula` : "Formula"}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          e.stopPropagation();
          open ? hide() : show();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") hide();
        }}
        style={{
          display: "inline-grid",
          placeItems: "center",
          width: 14,
          height: 14,
          borderRadius: "50%",
          border: "1px solid var(--line)",
          color: "var(--muted)",
          fontSize: 9,
          fontWeight: 700,
          fontStyle: "normal",
          cursor: "help",
          marginLeft: 6,
          verticalAlign: "middle",
          userSelect: "none",
          lineHeight: 1,
        }}
      >
        i
      </span>
      {open && pos && (
        <span
          id={id}
          role="tooltip"
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y - 8,
            transform: "translate(-50%, -100%)",
            maxWidth: 300,
            background: "var(--card-2)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: "9px 11px",
            fontSize: 11.5,
            lineHeight: 1.5,
            fontWeight: 400,
            letterSpacing: 0,
            textTransform: "none",
            whiteSpace: "normal",
            boxShadow: "0 8px 24px rgba(0,0,0,.34)",
            zIndex: 1000,
            pointerEvents: "none",
          }}
        >
          {label && (
            <b
              style={{ display: "block", marginBottom: 3, color: "var(--ink)" }}
            >
              {label}
            </b>
          )}
          <span
            style={{
              color: "var(--ink-2)",
              fontFamily: "var(--mono, ui-monospace, monospace)",
            }}
          >
            {text}
          </span>
        </span>
      )}
    </>
  );
}

// Exact formulas, mirroring the engine + the Formula Reference doc.
export const FORMULAS = {
  // group scores
  A: "Group A = Σ(factorScore × factorWeight / 0.29) for factors 1–4. Percentile-ranked price & relative-strength momentum.",
  B: "Group B = Σ(factorScore × factorWeight / 0.28) for factors 5–7. Forward earnings estimate momentum.",
  C: "Group C = Σ(factorScore × factorWeight / 0.23) for factors 8–10. Business quality & ROIC.",
  D: "Group D = Σ(factorScore × factorWeight / 0.12) for factors 11–13. Valuation discipline.",
  E: "Group E = Σ(factorScore × factorWeight / 0.08) for factors 14–15. Revenue & operating momentum.",
  composite:
    "Composite = A×0.29 + B×0.28 + C×0.23 + D×0.12 + E×0.08, then capped by any failed risk gate and rounded to 0–100.",
  weighted:
    "Weighted = percentile ÷ 100 × factor weight (its point contribution to the composite).",
  groupWeighted:
    "Group Weighted Score = groupScore ÷ 100 × group weight (points contributed to the composite, out of the group weight).",

  // per-factor
  f1: "1-Month Return vs S&P = stock 30-day return − SPY 30-day return, then percentile-ranked across the run.",
  f2: "10-Day Return vs S&P = stock 10-day return − SPY 10-day return, then percentile-ranked.",
  f3: "YTD Return vs S&P = stock YTD return − SPY YTD return, then percentile-ranked.",
  f4: "RSI zone score: 60–75 → 100, 75–80 → 80, >80 → 40, 40–60 → 55, <40 → 20 (14-day RSI).",
  f5: "EPS Next-Year Change % = (nextFY EPS − currentFY EPS) / |currentFY EPS| × 100, then percentile-ranked.",
  f6: "EPS Revisions Up = count of upward EPS revisions (30d), percentile-ranked.",
  f7: "EPS Revisions Down = count of downward EPS revisions (30d); inverted (100 − percentile).",
  f8: "ROIC = grossProfit / (marketCap + longTermDebt), then percentile-ranked.",
  f9: "Net Margin = AV ProfitMargin, percentile-ranked.",
  f10: "EPS Surprise % = AV surprisePercentage of the latest quarter, percentile-ranked.",
  f11: "EV/EBITDA = (marketCap + longTermDebt) / EBITDA; inverted (100 − percentile) — cheaper ranks higher.",
  f12: "P/FCF = marketCap / free cash flow; inverted (100 − percentile).",
  f13: "Trailing P/E = AV TrailingPE; inverted (100 − percentile).",
  f14: "Revenue Growth YoY = AV QuarterlyRevenueGrowthYOY, percentile-ranked.",
  f15: "Operating Margin TTM = AV OperatingMarginTTM, percentile-ranked.",

  // compare ratio rows (absolute)
  roic: "ROIC = grossProfit / (marketCap + longTermDebt). Absolute ratio, shown as a %.",
  ev: "EV/EBITDA = (marketCap + longTermDebt) / EBITDA. Absolute ratio (EBITDA ≤ 0 excluded).",
  pfcf: "P/FCF = marketCap / (operatingCashflow − |capEx|). Absolute ratio (FCF ≤ 0 excluded).",
  pe: "Trailing P/E taken directly from Alpha Vantage OVERVIEW.TrailingPE.",

  // header / detail
  delta:
    "Weekly Δ = composite(this run) − composite(last run). “—” within ±2, ▲/▼ otherwise, “NEW” if no prior score.",
  price:
    "Price = latest daily close from TIME_SERIES_DAILY (falls back to AnalystTargetPrice).",
  dayChange:
    "Day change = close[t] − close[t−1]; % = change / close[t−1] × 100 (day-over-day, not intraday).",
  tier: "Tier by composite: ≥85 High Alert, 70–84 Watch, 50–69 Neutral, 30–49 Weakening, <30 Deteriorating.",
  conf: "Triple Confluence = EPS next-year change > 0 AND price > 50-day SMA AND revenue growth YoY > 0.",

  // gates
  gateOCF:
    "Operating Cash Flow gate: must be > $0, else composite is capped at 45.",
  gateRev:
    "EPS Revision Net Balance gate: (up − down) 30-day revisions ≥ 0, else composite is capped at 50.",
  gateDebt:
    "Debt Growth vs Revenue gate: debt growth < revenue growth, else cap 55 (needs a prior snapshot).",
  gateDilution:
    "Share Dilution gate: share growth < 5% YoY, else cap 55 (needs a prior snapshot).",
} as const;
