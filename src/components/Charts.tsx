"use client";
import React, { useState } from "react";

// Sparkline for the results/detail history array (0..100).
export function Sparkline({
  data,
  w = 90,
  h = 26,
}: {
  data: number[];
  w?: number;
  h?: number;
}) {
  if (!data?.length) return null;
  const max = Math.max(...data),
    min = Math.min(...data);
  const rng = max - min || 1;
  const pts = data
    .map(
      (v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / rng) * h}`,
    )
    .join(" ");
  const up = data[data.length - 1] >= data[0];
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "var(--green)" : "var(--red)"}
        strokeWidth={1.6}
      />
    </svg>
  );
}

// Score History — composite trend over the last 8 runs (0–100 scale), with a
// fixed y-axis (0/25/50/75/100), week x-labels, area fill, and hover dots that
// reveal the exact score for each run.
export function ScoreHistoryChart({ data }: { data: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data?.length)
    return (
      <div style={{ color: "var(--muted)", fontSize: 12.5, padding: 20 }}>
        No score history.
      </div>
    );

  const W = 760,
    H = 300,
    P = { l: 40, r: 16, t: 16, b: 34 };
  const n = data.length;
  const iw = W - P.l - P.r,
    ih = H - P.t - P.b;
  const x = (i: number) => P.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v: number) => P.t + ih - (v / 100) * ih; // fixed 0..100

  const line = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `${x(0)},${y(0)} ${line} ${x(n - 1)},${y(0)}`;

  // x-axis labels: 8w, 6w, 4w, 2w, now (evenly across the series)
  const weekLabels = ["8w", "6w", "4w", "2w", "now"];
  const labelIdx = weekLabels.map((_, k) =>
    Math.round((k * (n - 1)) / (weekLabels.length - 1)),
  );

  const gridY = [0, 25, 50, 75, 100];

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", display: "block", overflow: "visible" }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="shg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--green)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--green)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* horizontal gridlines + y labels */}
        {gridY.map((v) => (
          <g key={v}>
            <line
              x1={P.l}
              x2={W - P.r}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--line-soft)"
            />
            <text
              x={P.l - 8}
              y={y(v) + 3}
              fontSize={11}
              fill="var(--muted)"
              textAnchor="end"
            >
              {v}
            </text>
          </g>
        ))}

        {/* x labels */}
        {weekLabels.map((lab, k) => (
          <text
            key={lab}
            x={x(labelIdx[k])}
            y={H - 12}
            fontSize={11}
            fill="var(--muted)"
            textAnchor="middle"
          >
            {lab}
          </text>
        ))}

        {/* area + line */}
        <polygon points={area} fill="url(#shg)" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--green)"
          strokeWidth={2.4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* hover guide + dots */}
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={P.t}
            y2={P.t + ih}
            stroke="var(--green)"
            strokeOpacity="0.35"
            strokeDasharray="3 3"
          />
        )}
        {data.map((v, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(v)}
            r={hover === i ? 5.5 : 3.4}
            fill={hover === i ? "var(--green)" : "var(--page)"}
            stroke="var(--green)"
            strokeWidth={2}
            style={{ transition: "r .12s" }}
          />
        ))}

        {/* invisible hit targets spanning each point's column */}
        {data.map((_, i) => (
          <rect
            key={i}
            x={i === 0 ? P.l : (x(i - 1) + x(i)) / 2}
            width={
              i === 0
                ? (x(0) + x(1)) / 2 - P.l
                : i === n - 1
                  ? W - P.r - (x(i - 1) + x(i)) / 2
                  : (x(i + 1) - x(i - 1)) / 2
            }
            y={P.t}
            height={ih}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      {/* tooltip */}
      {hover !== null && (
        <div
          style={{
            position: "absolute",
            left: `${(x(hover) / W) * 100}%`,
            top: `${(y(data[hover]) / H) * 100}%`,
            transform: "translate(-50%, -140%)",
            background: "var(--card-2)",
            border: "1px solid var(--line)",
            borderRadius: 7,
            padding: "6px 10px",
            fontSize: 12,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "0 6px 18px rgba(0,0,0,.28)",
            zIndex: 5,
          }}
        >
          <span style={{ color: "var(--muted)" }}>
            {hover === n - 1 ? "Now" : `${n - 1 - hover}w ago`}
          </span>{" "}
          <b style={{ color: "var(--green)", marginLeft: 6 }}>
            {Math.round(data[hover])}
          </b>
          <span style={{ color: "var(--muted)", fontSize: 10 }}>/100</span>
        </div>
      )}
    </div>
  );
}

// Score-distribution donut (dashboard).
export function Donut() {
  const segs: [string, number, string][] = [
    ["80–100", 155, "#1668e3"],
    ["60–79", 1240, "#3b8ef0"],
    ["40–59", 2280, "#f2b705"],
    ["20–39", 1685, "#f08c3b"],
    ["0–19", 561, "#e03131"],
  ];
  const total = segs.reduce((a, s) => a + s[1], 0);
  const R = 44,
    C = 2 * Math.PI * R;
  let off = 0;
  const arcs = segs.map(([l, v, c], idx) => {
    const len = (v / total) * C;
    const el = (
      <circle
        key={idx}
        r={R}
        cx={60}
        cy={60}
        fill="none"
        stroke={c}
        strokeWidth={16}
        strokeDasharray={`${len - 1.5} ${C - len + 1.5}`}
        strokeDashoffset={-off}
        transform="rotate(-90 60 60)"
      />
    );
    off += len;
    return el;
  });
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
      <svg width={120} height={120} viewBox="0 0 120 120">
        {arcs}
      </svg>
      <div style={{ flex: 1 }}>
        {segs.map(([l, v, c]) => (
          <div
            key={l}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 10.5,
              marginBottom: 6,
            }}
          >
            <span
              style={{ width: 9, height: 9, borderRadius: 2, background: c }}
            />
            <span style={{ flex: 1, color: "var(--muted)" }}>{l}</span>
            <b>({v})</b>
          </div>
        ))}
        <div
          style={{
            borderTop: "1px solid var(--line)",
            marginTop: 8,
            paddingTop: 7,
            fontSize: 11,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span style={{ color: "var(--muted)" }}>Total</span>
          <b>{total.toLocaleString()}</b>
        </div>
      </div>
    </div>
  );
}

// Trend-of-tiers line chart (dashboard).
export function TrendChart() {
  const W = 520,
    H = 200,
    P = { l: 32, r: 12, t: 12, b: 26 };
  const series = [
    { n: "High Alert", c: "#1668e3", d: [16, 17, 19, 18, 20] },
    { n: "Watch", c: "#3ddc84", d: [25, 27, 31, 28, 30] },
    { n: "Breakdown", c: "#e03131", d: [14, 15, 18, 16, 17] },
  ];
  const labels = ["Apr 15", "Apr 22", "Apr 29", "May 6", "May 13"];
  const max = 36;
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / 4;
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const grid: React.ReactNode[] = [];
  for (let v = 0; v <= 30; v += 10) {
    grid.push(
      <g key={v}>
        <line
          x1={P.l}
          x2={W - P.r}
          y1={y(v)}
          y2={y(v)}
          stroke="var(--line-soft)"
        />
        <text
          x={P.l - 7}
          y={y(v) + 3}
          fontSize={9}
          fill="#7a869a"
          textAnchor="end"
        >
          {v}
        </text>
      </g>,
    );
  }
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 14,
          justifyContent: "flex-end",
          marginBottom: 6,
        }}
      >
        {series.map((s) => (
          <span
            key={s.n}
            style={{
              fontSize: 10,
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span
              style={{
                width: 14,
                height: 2,
                background: s.c,
                display: "inline-block",
              }}
            />
            {s.n}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }}>
        {grid}
        {series.map((s) => (
          <g key={s.n}>
            <polyline
              points={s.d.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              fill="none"
              stroke={s.c}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {s.d.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={2.8} fill={s.c} />
            ))}
          </g>
        ))}
        {labels.map((l, i) => (
          <text
            key={l}
            x={x(i)}
            y={H - 8}
            fontSize={9}
            fill="#7a869a"
            textAnchor="middle"
          >
            {l}
          </text>
        ))}
      </svg>
    </div>
  );
}

// Price line chart for the detail page (from close series).
export function PriceChart({
  closes,
}: {
  closes: { date: string; close: number }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!closes?.length)
    return (
      <div style={{ color: "var(--muted)", fontSize: 12.5, padding: 20 }}>
        No price history.
      </div>
    );

  const W = 760,
    H = 300,
    P = { l: 46, r: 16, t: 16, b: 34 };
  const n = closes.length;
  const iw = W - P.l - P.r,
    ih = H - P.t - P.b;
  const vals = closes.map((c) => c.close);
  const max = Math.max(...vals),
    min = Math.min(...vals),
    rng = max - min || 1;
  const x = (i: number) => P.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v: number) => P.t + ih - ((v - min) / rng) * ih;

  const line = closes.map((c, i) => `${x(i)},${y(c.close)}`).join(" ");
  const area = `${x(0)},${P.t + ih} ${line} ${x(n - 1)},${P.t + ih}`;
  const up = vals[vals.length - 1] >= vals[0];
  const stroke = up ? "var(--green)" : "var(--red)";

  // date formatting for x-axis + tooltip
  const fmtDate = (d: string, withYear = false) => {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "2-digit" } : {}),
    });
  };
  // ~6 evenly spaced x labels
  const xTicks = 5;
  const xLabelIdx = Array.from({ length: xTicks + 1 }, (_, k) =>
    Math.round((k * (n - 1)) / xTicks),
  );

  const gridY: React.ReactNode[] = [];
  for (let k = 0; k <= 4; k++) {
    const v = min + (rng * k) / 4;
    gridY.push(
      <g key={k}>
        <line
          x1={P.l}
          x2={W - P.r}
          y1={y(v)}
          y2={y(v)}
          stroke="var(--line-soft)"
        />
        <text
          x={P.l - 8}
          y={y(v) + 3}
          fontSize={11}
          fill="var(--muted)"
          textAnchor="end"
        >
          {v.toFixed(0)}
        </text>
      </g>,
    );
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", display: "block", overflow: "visible" }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="pcg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="1" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridY}

        {/* x-axis date labels */}
        {xLabelIdx.map((idx, k) => (
          <text
            key={k}
            x={x(idx)}
            y={H - 12}
            fontSize={11}
            fill="var(--muted)"
            textAnchor={k === 0 ? "start" : k === xTicks ? "end" : "middle"}
          >
            {fmtDate(closes[idx].date)}
          </text>
        ))}

        <polygon points={area} fill="url(#pcg)" />
        <polyline
          points={line}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* hover guide + dot */}
        {hover !== null && (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={P.t}
              y2={P.t + ih}
              stroke={stroke}
              strokeOpacity="0.35"
              strokeDasharray="3 3"
            />
            <circle
              cx={x(hover)}
              cy={y(closes[hover].close)}
              r={5}
              fill="var(--page)"
              stroke={stroke}
              strokeWidth={2.2}
            />
          </>
        )}

        {/* hit target follows the pointer across the plot */}
        <rect
          x={P.l}
          y={P.t}
          width={iw}
          height={ih}
          fill="transparent"
          onMouseMove={(e) => {
            const svg = e.currentTarget.ownerSVGElement!;
            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const ctm = svg.getScreenCTM();
            if (!ctm) return;
            const loc = pt.matrixTransform(ctm.inverse());
            const rel = (loc.x - P.l) / iw;
            const idx = Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1))));
            setHover(idx);
          }}
        />
      </svg>

      {/* tooltip */}
      {hover !== null && (
        <div
          style={{
            position: "absolute",
            left: `${(x(hover) / W) * 100}%`,
            top: `${(y(closes[hover].close) / H) * 100}%`,
            transform: `translate(${hover > n * 0.7 ? "-108%" : "8%"}, -120%)`,
            background: "var(--card-2)",
            border: "1px solid var(--line)",
            borderRadius: 7,
            padding: "6px 10px",
            fontSize: 12,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "0 6px 18px rgba(0,0,0,.28)",
            zIndex: 5,
          }}
        >
          <span style={{ color: "var(--muted)" }}>
            {fmtDate(closes[hover].date, true)}
          </span>
          <b style={{ color: stroke, marginLeft: 8 }}>
            ${closes[hover].close.toFixed(2)}
          </b>
        </div>
      )}
    </div>
  );
}
