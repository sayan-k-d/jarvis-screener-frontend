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
            }}
          >
            {text}
          </span>
        </span>
      )}
    </>
  );
}

// Short plain-language descriptions shown in the info tooltips. These deliberately
// explain WHAT a value tells you, not HOW it is calculated - no formulas, weights,
// thresholds or caps. Keep new entries in the same style.
export const FORMULAS = {
  // group scores
  A: "Shows how strongly the stock's price has been moving compared with the overall market, across recent weeks and the year so far.",
  B: "Reflects how professional analysts' earnings expectations for the company are changing - a forward-looking read on where profits are heading.",
  C: "Measures how profitable and efficient the business is, including how well it turns capital into returns and how it performs against earnings expectations.",
  D: "Indicates whether the stock looks reasonably priced against its earnings, cash flow and its own history, to avoid chasing overvalued names.",
  E: "Confirms whether the company's reported sales and operating profitability are actually improving.",
  composite:
    "Jarvis's overall momentum score from 0 to 100. It blends price strength, earnings expectations, business quality, valuation and growth, and is held back when a risk check is not passed.",
  weighted:
    "How much this factor contributes to the stock's overall score, based on its score and its importance.",
  groupWeighted:
    "How much this group of factors contributes to the stock's overall score.",

  // per-factor
  f1: "How much the stock has outperformed or lagged the S&P 500 over roughly the past month. Bigger outperformance scores higher.",
  f2: "A short-term version of relative performance, capturing stocks that are gaining momentum right now compared with the S&P 500.",
  f3: "How the stock has performed against the S&P 500 so far this year. Helps confirm that strength is sustained rather than a one-week spike.",
  f4: "A gauge of whether recent buying pressure is healthy. Strong-but-not-stretched momentum scores best; overheated or weak readings score lower.",
  f5: "How much analysts expect the company's earnings to grow next year versus this year. Higher expected growth scores higher.",
  f6: "How many analysts have recently raised their earnings estimates. More upgrades is a positive sign.",
  f7: "How many analysts have recently lowered their earnings estimates. Fewer downgrades scores better.",
  f8: "A measure of how efficiently the company uses its capital to generate profit. Higher is better.",
  f9: "How much of each sales dollar the company keeps as profit, with extra credit when that margin has been improving.",
  f10: "How far the company's latest quarterly earnings came in above or below analyst expectations. Bigger beats score higher.",
  f11: "Compares the company's total value with its operating earnings. Cheaper relative to earnings scores better.",
  f12: "Compares the company's market value with the free cash it generates. Cheaper relative to cash flow scores better.",
  f13: "Shows whether the stock is priced low or high relative to its own five-year history of earnings multiples. Trading near its historical low scores best.",
  f14: "How fast the company's sales are growing versus a year ago, with extra credit if growth is speeding up.",
  f15: "Whether the company's operating profit margin is improving or slipping, which signals operating leverage.",

  // compare ratio rows (absolute)
  roic: "A simple gauge of how effectively the company turns the capital invested in it into profit.",
  ev: "Compares the company's total value with its operating earnings. Lower can indicate a cheaper valuation.",
  pfcf: "Compares the company's market value with the free cash flow it generates. Lower can indicate a cheaper valuation.",
  pe: "The share price relative to the company's earnings per share over the last twelve months, as reported by the data provider.",

  // header / detail
  delta:
    "How the score has changed since the previous comparison run. An arrow shows the direction; a dash means little change; NEW means the stock was not in the earlier run.",
  price: "The most recent closing share price.",
  dayChange: "The change in the closing price versus the previous trading day.",
  tier: "Groups stocks by overall score, from High Alert (strongest) down to Deteriorating (weakest).",
  conf: "A star marks stocks where earnings expectations, price trend and sales growth are all moving in the right direction at the same time.",

  // gates
  gateOCF:
    "A safety check that the company is generating positive cash from its day-to-day operations. Failing it limits the stock's score.",
  gateRev:
    "A safety check that analysts are not, on balance, cutting their earnings estimates. Failing it limits the stock's score.",
  gateDebt:
    "A safety check that the company's debt is not growing faster than its sales. Failing it flags the stock and limits its score.",
  gateDilution:
    "A safety check that existing shareholders are not being heavily diluted by new share issuance. Failing it flags the stock and limits its score.",
} as const;
