'use client';
import React from 'react';

// Sparkline for the results/detail history array (0..100).
export function Sparkline({ data, w = 90, h = 26 }: { data: number[]; w?: number; h?: number }) {
  if (!data?.length) return null;
  const max = Math.max(...data),
    min = Math.min(...data);
  const rng = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / rng) * h}`)
    .join(' ');
  const up = data[data.length - 1] >= data[0];
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={up ? 'var(--green)' : 'var(--red)'} strokeWidth={1.6} />
    </svg>
  );
}

// Score-distribution donut (dashboard).
export function Donut() {
  const segs: [string, number, string][] = [
    ['80–100', 155, '#1668e3'],
    ['60–79', 1240, '#3b8ef0'],
    ['40–59', 2280, '#f2b705'],
    ['20–39', 1685, '#f08c3b'],
    ['0–19', 561, '#e03131'],
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
    <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
      <svg width={120} height={120} viewBox="0 0 120 120">
        {arcs}
      </svg>
      <div style={{ flex: 1 }}>
        {segs.map(([l, v, c]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10.5, marginBottom: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: c }} />
            <span style={{ flex: 1, color: 'var(--muted)' }}>{l}</span>
            <b>({v})</b>
          </div>
        ))}
        <div
          style={{
            borderTop: '1px solid var(--line)',
            marginTop: 8,
            paddingTop: 7,
            fontSize: 11,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ color: 'var(--muted)' }}>Total</span>
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
    { n: 'High Alert', c: '#1668e3', d: [16, 17, 19, 18, 20] },
    { n: 'Watch', c: '#3ddc84', d: [25, 27, 31, 28, 30] },
    { n: 'Breakdown', c: '#e03131', d: [14, 15, 18, 16, 17] },
  ];
  const labels = ['Apr 15', 'Apr 22', 'Apr 29', 'May 6', 'May 13'];
  const max = 36;
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / 4;
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const grid: React.ReactNode[] = [];
  for (let v = 0; v <= 30; v += 10) {
    grid.push(
      <g key={v}>
        <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--line-soft)" />
        <text x={P.l - 7} y={y(v) + 3} fontSize={9} fill="#7a869a" textAnchor="end">
          {v}
        </text>
      </g>,
    );
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end', marginBottom: 6 }}>
        {series.map((s) => (
          <span key={s.n} style={{ fontSize: 10, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 14, height: 2, background: s.c, display: 'inline-block' }} />
            {s.n}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }}>
        {grid}
        {series.map((s) => (
          <g key={s.n}>
            <polyline
              points={s.d.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
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
          <text key={l} x={x(i)} y={H - 8} fontSize={9} fill="#7a869a" textAnchor="middle">
            {l}
          </text>
        ))}
      </svg>
    </div>
  );
}

// Price line chart for the detail page (from close series).
export function PriceChart({ closes }: { closes: { date: string; close: number }[] }) {
  if (!closes?.length) return <div style={{ color: 'var(--muted)', fontSize: 12.5, padding: 20 }}>No price history.</div>;
  const W = 700,
    H = 220,
    P = { l: 40, r: 12, t: 12, b: 24 };
  const vals = closes.map((c) => c.close);
  const max = Math.max(...vals),
    min = Math.min(...vals),
    rng = max - min || 1;
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / (closes.length - 1 || 1);
  const y = (v: number) => H - P.b - ((v - min) / rng) * (H - P.t - P.b);
  const line = closes.map((c, i) => `${x(i)},${y(c.close)}`).join(' ');
  const area = `${P.l},${H - P.b} ${line} ${x(closes.length - 1)},${H - P.b}`;
  const up = vals[vals.length - 1] >= vals[0];
  const stroke = up ? 'var(--green)' : 'var(--red)';
  const grid: React.ReactNode[] = [];
  for (let k = 0; k <= 4; k++) {
    const v = min + (rng * k) / 4;
    grid.push(
      <g key={k}>
        <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--line-soft)" />
        <text x={P.l - 6} y={y(v) + 3} fontSize={9} fill="var(--muted)" textAnchor="end">
          {v.toFixed(0)}
        </text>
      </g>,
    );
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }}>
      <defs>
        <linearGradient id="pcg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid}
      <polyline points={area} fill="url(#pcg)" stroke="none" />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth={1.8} />
    </svg>
  );
}
