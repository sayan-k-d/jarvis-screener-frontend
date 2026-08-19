"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  adaptRow,
  fmtCap,
  fmtBig,
  pct,
  qLabel,
  parseNews,
  sentimentBand,
  relTime,
} from "@/lib/format";
import { TierBadge } from "@/components/ui";
import { PriceChart, Sparkline, ScoreHistoryChart } from "@/components/Charts";

// Spec factor definitions, ported verbatim from the original app. Each factor's
// val(r) reads the live raw metric; fKey maps to its percentile/zone score
// (row.factors[fKey]); w is the factor's weight within the composite (points).
const fmtPctVal = (v: number, d = 1) =>
  isFinite(v) ? (v >= 0 ? "+" : "") + v.toFixed(d) + "%" : "—";

interface GroupFactor {
  n: string;
  desc: string;
  fKey: string;
  w: number;
  val: (r: any) => string;
}
interface FactorGroup {
  L: string;
  name: string;
  w: number;
  f: GroupFactor[];
}

const GROUPS: FactorGroup[] = [
  {
    L: "A",
    name: "Price & Relative Strength Momentum",
    w: 29,
    f: [
      {
        n: "1-Month Return vs. S&P 500",
        desc: "30-day return minus SPY",
        fKey: "f1",
        w: 10,
        val: (r) => fmtPctVal(r.rel30),
      },
      {
        n: "10-Day Return vs. S&P 500",
        desc: "10-day return minus SPY",
        fKey: "f2",
        w: 5,
        val: (r) => fmtPctVal(r.rel10),
      },
      {
        n: "YTD Return vs. S&P 500",
        desc: "YTD return minus SPY",
        fKey: "f3",
        w: 9,
        val: (r) => fmtPctVal(r.relYTD),
      },
      {
        n: "Relative Strength Index (RSI)",
        desc: "14-day RSI (zone-scored)",
        fKey: "f4",
        w: 5,
        val: (r) => (isFinite(r.rsi) ? r.rsi.toFixed(1) : "—"),
      },
    ],
  },
  {
    L: "B",
    name: "Forward Earnings Estimate Momentum",
    w: 28,
    f: [
      {
        n: "EPS Next Year Change (Est. %)",
        desc: "(next FY − current FY) / |current FY|",
        fKey: "f5",
        w: 15,
        val: (r) => fmtPctVal(r.epsNextChg),
      },
      {
        n: "EPS Revisions Up — 30 Days",
        desc: "Upward analyst revisions",
        fKey: "f6",
        w: 7,
        val: (r) => (isFinite(r.revUp) ? String(r.revUp) : "—"),
      },
      {
        n: "EPS Revisions Down — 30 Days",
        desc: "Downward revisions (inverted)",
        fKey: "f7",
        w: 6,
        val: (r) => (isFinite(r.revDown) ? String(r.revDown) : "—"),
      },
    ],
  },
  {
    L: "C",
    name: "Business Quality & ROIC",
    w: 23,
    f: [
      {
        n: "ROIC — Return on Invested Capital",
        desc: "Gross Profit / (Mkt Cap + LT Debt)",
        fKey: "f8",
        w: 10,
        val: (r) => (isFinite(r.roic) ? (r.roic * 100).toFixed(1) + "%" : "—"),
      },
      {
        n: "Net Margin",
        desc: "Profit margin",
        fKey: "f9",
        w: 5,
        val: (r) =>
          isFinite(r.netMargin) ? (r.netMargin * 100).toFixed(1) + "%" : "—",
      },
      {
        n: "EPS Surprise % (Most Recent Q)",
        desc: "Reported vs estimate",
        fKey: "f10",
        w: 8,
        val: (r) => fmtPctVal(r.epsSurprise),
      },
    ],
  },
  {
    L: "D",
    name: "Valuation Discipline",
    w: 12,
    f: [
      {
        n: "EV / EBITDA",
        desc: "(Mkt Cap + LT Debt) / EBITDA — inverted",
        fKey: "f11",
        w: 4,
        val: (r) => (isFinite(r.evEbitda) ? r.evEbitda.toFixed(1) : "—"),
      },
      {
        n: "Price / Free Cash Flow",
        desc: "Mkt Cap / FCF — inverted",
        fKey: "f12",
        w: 4,
        val: (r) => (isFinite(r.pfcf) ? r.pfcf.toFixed(1) : "—"),
      },
      {
        n: "Trailing P/E",
        desc: "Lower is better — inverted",
        fKey: "f13",
        w: 4,
        val: (r) => (isFinite(r.trailingPE) ? r.trailingPE.toFixed(1) : "—"),
      },
    ],
  },
  {
    L: "E",
    name: "Revenue & Operating Momentum",
    w: 8,
    f: [
      {
        n: "Revenue Growth YOY (Trailing)",
        desc: "Quarterly revenue growth YoY",
        fKey: "f14",
        w: 4,
        val: (r) =>
          isFinite(r.revGrowthYoY)
            ? (r.revGrowthYoY * 100).toFixed(1) + "%"
            : "—",
      },
      {
        n: "Operating Margin TTM",
        desc: "Operating margin",
        fKey: "f15",
        w: 4,
        val: (r) =>
          isFinite(r.opMargin) ? (r.opMargin * 100).toFixed(1) + "%" : "—",
      },
    ],
  },
];

// group letter -> sub-score field on the adapted row
const SUB_KEYS: Record<string, string> = {
  A: "subA",
  B: "subB",
  C: "subC",
  D: "subD",
  E: "subE",
};

const TABS = [
  ["overview", "Overview"],
  ["factors", "Factors"],
  ["financials", "Financials"],
  ["gates", "Risk Gates"],
  ["news", "News"],
  ["chart", "Chart"],
];

function scoreColor(v: number) {
  return v >= 85
    ? "var(--green)"
    : v >= 70
      ? "var(--amber)"
      : v >= 50
        ? "var(--blue)"
        : "var(--red)";
}

// Group badge color, ported from HTML: >=85 green, >=70 amber, else red.
function groupColor(v: number) {
  return v >= 85 ? "#12a150" : v >= 70 ? "#f2b705" : "#e03131";
}

// Percentile pill, ported from HTML pctPill(): >=85 green, >=60 amber, else red.
function PctPill({ p }: { p: number }) {
  const v = Math.round(p);
  const hi = v >= 85,
    mid = v >= 60;
  return (
    <span
      style={{
        background: hi ? "#10241a" : mid ? "#2a2410" : "#2a1417",
        color: hi ? "#4ee89a" : mid ? "#f2c94c" : "#ff8a8e",
        padding: "2px 8px",
        borderRadius: 4,
        fontWeight: 700,
        fontSize: 11,
      }}
    >
      {v}
    </span>
  );
}

export default function DetailPage({ ticker }: { ticker: string }) {
  const [dtab, setDtab] = useState("overview");
  const [payload, setPayload] = useState<any>(null);
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [factorView, setFactorView] = useState("Factor Groups");
  const [openG, setOpenG] = useState<string | null>("A");
  const [news, setNews] = useState<{ items: any[]; avg: number } | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setNews(null);
    api
      .detail(ticker)
      .then((res) => {
        if (!alive) return;
        setPayload(res.payload);
        setRow(res.scored ? adaptRow(res.scored) : null);
        if (!res.scored) setError(`No usable data returned for ${ticker}.`);
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [ticker]);

  // Lazy-load news when the News tab opens.
  useEffect(() => {
    if (dtab === "news" && !news && !newsLoading) {
      setNewsLoading(true);
      api
        .news(ticker)
        .then((j) => setNews(parseNews(j, ticker)))
        .catch(() => setNews({ items: [], avg: NaN }))
        .finally(() => setNewsLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dtab]);

  if (loading)
    return (
      <div
        className="card card-pad"
        style={{ textAlign: "center", padding: 60 }}
      >
        <span className="spin" />
        <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 12.5 }}>
          Loading {ticker}…
        </div>
      </div>
    );
  if (error && !row)
    return (
      <div className="card card-pad" style={{ color: "var(--muted)" }}>
        {error}
      </div>
    );
  if (!row) return null;

  const dv = Math.round(row.d || 0);

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-pad">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  style={{
                    background: "var(--navy)",
                    color: "var(--ink)",
                    padding: "5px 11px",
                    borderRadius: 6,
                    fontWeight: 800,
                    fontSize: 17,
                    border: "1px solid var(--line)",
                  }}
                >
                  {row.t}
                </span>
                <span style={{ fontSize: 19, fontWeight: 700 }}>{row.n}</span>
              </div>
              <div
                style={{ fontSize: 12, color: "var(--muted)", marginTop: 9 }}
              >
                {row.s} &gt; {row.ind}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <TierBadge tier={row.tier} />
              {row.conf ? (
                <div
                  className="star"
                  style={{ fontSize: 11.5, fontWeight: 600, marginTop: 8 }}
                >
                  ★ Triple Confluence
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid g3" style={{ marginBottom: 14 }}>
        <div className="card card-pad" style={{ textAlign: "center" }}>
          <div
            style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}
          >
            Composite Score
          </div>
          <div
            style={{
              fontSize: 44,
              fontWeight: 800,
              marginTop: 10,
              letterSpacing: "-.03em",
            }}
          >
            {row.sc}
            <span
              style={{ fontSize: 15, color: "var(--muted)", fontWeight: 600 }}
            >
              /100
            </span>
          </div>
        </div>
        <div className="card card-pad" style={{ textAlign: "center" }}>
          <div
            style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}
          >
            Weekly Delta
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              marginTop: 12,
              color: row.isNew
                ? "#f2c94c"
                : Math.abs(dv) <= 2
                  ? "var(--muted)"
                  : dv > 0
                    ? "var(--green)"
                    : "var(--red)",
            }}
          >
            {row.isNew
              ? "NEW"
              : `${Math.abs(dv) <= 2 ? "— " : dv > 0 ? "▲ " : "▼ "}${Math.abs(dv) <= 2 ? (dv >= 0 ? "+" : "") + dv : Math.abs(dv)}`}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8 }}>
            {row.isNew ? "first appearance" : "vs last run"}
          </div>
        </div>
        <div className="card card-pad">
          {[
            ["Price", row.priceStr],
            ["Market Cap", row.capStr],
            ["Sector", row.s],
            ["Industry", row.ind],
          ].map(([k, v], i) => (
            <div
              key={k as string}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "7px 0",
                fontSize: 12,
                borderBottom: i < 3 ? "1px solid var(--line-soft)" : "none",
              }}
            >
              <span style={{ color: "var(--muted)" }}>{k}</span>
              <b>{v}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="tabs">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              className={`tab ${dtab === id ? "active" : ""}`}
              onClick={() => setDtab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {dtab === "overview" && (
          <>
            <div className="grid g2 card-pad">
              <div>
                <div
                  style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}
                >
                  Group Scores
                </div>
                {GROUPS.map((g) => {
                  const val = row[SUB_KEYS[g.L]];
                  return (
                    <div key={g.L} style={{ marginBottom: 13 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                          marginBottom: 5,
                        }}
                      >
                        <span>{g.name}</span>
                        <b>{val}</b>
                      </div>
                      <div
                        style={{
                          height: 7,
                          background: "var(--line-soft)",
                          borderRadius: 5,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${val}%`,
                            height: "100%",
                            background: scoreColor(val),
                            borderRadius: 5,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div>
                <div
                  style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}
                >
                  Score History
                </div>
                <ScoreHistoryChart data={row.hist} />
                <div
                  style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}
                >
                  Composite trend (last 8 runs, modeled)
                </div>
              </div>
            </div>
            <div
              style={{ borderTop: "1px solid var(--line)" }}
              className="card-pad"
            >
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
                Key Stats
              </div>
              <div className="grid g4">
                {[
                  ["52W High", row.hiStr],
                  ["52W Low", row.loStr],
                  ["Beta", row.betaStr],
                  ["Volume", row.volStr],
                  ["ROIC", row.roicStr],
                  ["EV/EBITDA", row.evStr],
                  ["P/FCF", row.pfcfStr],
                  ["Trailing P/E", row.peStr],
                ].map(([k, v]) => (
                  <div
                    key={k as string}
                    style={{
                      background: "var(--card-2)",
                      borderRadius: 8,
                      padding: "11px 13px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10.5,
                        color: "var(--muted)",
                        fontWeight: 600,
                      }}
                    >
                      {k}
                    </div>
                    <div
                      style={{ fontSize: 16, fontWeight: 800, marginTop: 5 }}
                    >
                      {v}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* FACTORS */}
        {dtab === "factors" && (
          <>
            <div
              className="toolbar"
              style={{ borderBottom: 0, justifyContent: "space-between" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  View by
                </span>
                <select
                  className="sel"
                  value={factorView}
                  onChange={(e) => setFactorView(e.target.value)}
                >
                  <option>Factor Groups</option>
                  <option>All Factors</option>
                </select>
              </div>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                All scores are percentile ranks (0–100)
              </span>
            </div>
            <div style={{ padding: "0 18px 18px" }}>
              {factorView === "Factor Groups" ? (
                GROUPS.map((g) => {
                  const sub = Math.round(row[SUB_KEYS[g.L]] || 0);
                  const open = openG === g.L;
                  return (
                    <div
                      key={g.L}
                      style={{
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        marginTop: 12,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 13,
                          padding: "14px 16px",
                          cursor: "pointer",
                          background: "var(--card)",
                        }}
                        onClick={() => setOpenG(open ? null : g.L)}
                      >
                        <span
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            background: groupColor(sub),
                            color: "#fff",
                            display: "grid",
                            placeItems: "center",
                            fontWeight: 800,
                            fontSize: 12,
                          }}
                        >
                          {g.L}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>
                            {g.name}
                          </div>
                          <div
                            style={{
                              fontSize: 10.5,
                              color: "var(--muted)",
                              marginTop: 2,
                            }}
                          >
                            Group Weight: {g.w}%
                          </div>
                        </div>
                        <b style={{ fontSize: 16 }}>{sub}</b>
                        <span style={{ fontSize: 10, color: "var(--muted)" }}>
                          /100
                        </span>
                        <span
                          style={{
                            color: "var(--muted)",
                            transform: `rotate(${open ? 180 : 0}deg)`,
                            transition: "transform .18s",
                          }}
                        >
                          ⌄
                        </span>
                      </div>
                      {open && (
                        <div
                          style={{
                            borderTop: "1px solid var(--line)",
                            overflowX: "auto",
                          }}
                        >
                          <table>
                            <thead>
                              <tr>
                                <th>Factor</th>
                                <th>Description</th>
                                <th>Value</th>
                                <th>Percentile</th>
                                <th>Weight</th>
                                <th>Weighted</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.f.map((f) => {
                                const pctv = row.factors[f.fKey] || 0;
                                return (
                                  <tr key={f.fKey}>
                                    <td>{f.n}</td>
                                    <td style={{ color: "var(--muted)" }}>
                                      {f.desc}
                                    </td>
                                    <td>{f.val(row)}</td>
                                    <td>
                                      <PctPill p={pctv} />
                                    </td>
                                    <td>{f.w}%</td>
                                    <td className="num">
                                      {((pctv / 100) * f.w).toFixed(1)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              padding: "13px 16px",
                              borderTop: "1px solid var(--line)",
                              background: "var(--card-2)",
                            }}
                          >
                            <b style={{ fontSize: 12.5 }}>
                              Group Weighted Score
                            </b>
                            <b style={{ fontSize: 16 }}>
                              {((sub / 100) * g.w).toFixed(1)}
                              <span
                                style={{ fontSize: 11, color: "var(--muted)" }}
                              >
                                /{g.w}
                              </span>
                            </b>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    marginTop: 12,
                    overflowX: "auto",
                  }}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Group</th>
                        <th>Factor</th>
                        <th>Value</th>
                        <th>Percentile</th>
                        <th>Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {GROUPS.flatMap((g) =>
                        g.f.map((f) => ({ L: g.L, f })),
                      ).map(({ L, f }) => (
                        <tr key={f.fKey}>
                          <td>
                            <b>{L}</b>
                          </td>
                          <td>{f.n}</td>
                          <td>{f.val(row)}</td>
                          <td>
                            <PctPill p={row.factors[f.fKey] || 0} />
                          </td>
                          <td>{f.w}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* FINANCIALS */}
        {dtab === "financials" && <Financials payload={payload} row={row} />}

        {/* RISK GATES */}
        {dtab === "gates" && <Gates row={row} />}

        {/* NEWS */}
        {dtab === "news" && (
          <div className="card-pad">
            {newsLoading ? (
              <div
                style={{
                  textAlign: "center",
                  color: "var(--muted)",
                  padding: 24,
                  fontSize: 12.5,
                }}
              >
                <span
                  className="spin"
                  style={{ marginRight: 8, verticalAlign: "middle" }}
                />
                Loading news &amp; sentiment…
              </div>
            ) : news && news.items.length ? (
              <NewsList news={news} sym={ticker} />
            ) : (
              <div
                style={{ color: "var(--muted)", fontSize: 12.5, padding: 16 }}
              >
                No recent news returned for {ticker}.
              </div>
            )}
          </div>
        )}

        {/* CHART */}
        {dtab === "chart" && (
          <div className="card-pad">
            <PriceChart closes={payload?.closes || []} />
          </div>
        )}
      </div>
    </>
  );
}

function Financials({ payload, row }: { payload: any; row: any }) {
  const q = (payload?.quarters || []).slice().reverse();
  const stats = [
    ["Market Cap", fmtCap(row.marketCap)],
    ["Trailing P/E", row.peStr],
    ["ROIC", row.roicStr],
    ["EV/EBITDA", row.evStr],
    ["P/FCF", row.pfcfStr],
    ["Beta", row.betaStr],
    ["52W High", row.hiStr],
    ["52W Low", row.loStr],
  ];
  const rows: [string, (x: any) => string][] = [
    ["Revenue", (x) => fmtBig(x.revenue)],
    [
      "Gross Margin",
      (x) =>
        isFinite(x.grossMargin) ? (x.grossMargin * 100).toFixed(1) + "%" : "—",
    ],
    ["Operating Income", (x) => fmtBig(x.operatingIncome)],
    ["Net Income", (x) => fmtBig(x.netIncome)],
    ["EPS", (x) => (isFinite(x.eps) ? "$" + x.eps.toFixed(2) : "—")],
  ];
  return (
    <div className="card-pad">
      <div className="grid g4">
        {stats.map(([k, v]) => (
          <div
            key={k}
            style={{
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "11px 13px",
            }}
          >
            <div
              style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 600 }}
            >
              {k}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 5 }}>
              {v}
            </div>
          </div>
        ))}
      </div>
      {q.length ? (
        <div style={{ overflowX: "auto", marginTop: 18 }}>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                {q.map((x: any) => (
                  <th key={x.end} style={{ textAlign: "right" }}>
                    {qLabel(x.end)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, fn]) => (
                <tr key={label}>
                  <td style={{ fontWeight: 600 }}>{label}</td>
                  {q.map((x: any, i: number) => (
                    <td key={i} className="num" style={{ textAlign: "right" }}>
                      {fn(x)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ color: "var(--muted)", fontSize: 12.5, padding: 16 }}>
          Quarterly financials not available.
        </div>
      )}
    </div>
  );
}

function Gates({ row }: { row: any }) {
  const all = row.gatesPassed !== false;
  return (
    <>
      <div className="card-head" style={{ borderTop: 0 }}>
        <div>
          <h3>Risk Gates</h3>
          <div className="sub">All gates must pass to be eligible</div>
        </div>
        <span className={`badge ${all ? "b-ok" : "b-break"}`}>
          {all ? "ALL PASSED" : "GATE FAILED"}
        </span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Gate</th>
            <th>Status</th>
            <th>Value</th>
            <th>Threshold</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {(row.gates || []).map((g: any) => (
            <tr key={g.name}>
              <td>{g.name}</td>
              <td>
                <span className={`badge ${g.pass ? "b-pass" : "b-break"}`}>
                  {g.pass ? "⊙ PASS" : "⊗ FAIL"}
                </span>
              </td>
              <td className="num">{g.value}</td>
              <td style={{ color: "var(--muted)" }}>{g.threshold}</td>
              <td style={{ color: "var(--muted)" }}>{g.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div
        style={{
          margin: "16px 18px 18px",
          padding: "12px 14px",
          background: all ? "var(--green-bg)" : "var(--red-bg)",
          border: `1px solid ${all ? "#1f4a34" : "#4a2226"}`,
          borderRadius: 8,
          fontSize: 12,
          color: all ? "var(--green)" : "#ff8a8e",
        }}
      >
        {all
          ? "⊙ This stock passes all risk gates and is eligible for the screener results."
          : `⊗ A risk gate failed — composite is capped at ${row.scoreCap}. Cannot appear in HIGH ALERT or WATCH.`}
      </div>
    </>
  );
}

function NewsList({
  news,
  sym,
}: {
  news: { items: any[]; avg: number };
  sym: string;
}) {
  const band = sentimentBand(news.avg);
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          background: "var(--card-2)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
            AGGREGATE NEWS SENTIMENT
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
            {news.items.length} recent articles · Alpha Vantage
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span className={`senti ${band.cls}`} style={{ fontSize: 12 }}>
            {band.label}
          </span>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            avg score {isFinite(news.avg) ? news.avg.toFixed(3) : "—"}
          </div>
        </div>
      </div>
      {news.items.map((a, i) => {
        const b = sentimentBand(a.score);
        const sc = isFinite(a.score)
          ? (a.score >= 0 ? "+" : "") + a.score.toFixed(2)
          : "—";
        return (
          <div
            key={i}
            style={{
              padding: "13px 0",
              borderTop: i ? "1px solid var(--line-soft)" : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--ink)",
                  lineHeight: 1.4,
                  flex: 1,
                }}
              >
                {a.title}
              </a>
              <span className={`senti ${b.cls}`}>
                {b.label} {sc}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>
              {[a.source, relTime(a.time)].filter(Boolean).join(" · ")}
              {isFinite(a.relevance)
                ? ` · relevance ${(a.relevance * 100).toFixed(0)}%`
                : ""}
            </div>
            {a.summary ? (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--ink-2)",
                  marginTop: 6,
                  lineHeight: 1.5,
                }}
              >
                {a.summary.length > 220
                  ? a.summary.slice(0, 220) + "…"
                  : a.summary}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
